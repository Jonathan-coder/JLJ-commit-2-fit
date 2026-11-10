/* api.js – alle Zugriffe auf das Backend (REST/JSON, Anmeldung mit JWT).
   Die Endpunkte stehen in backend/openapi.yaml (Swagger: /api-docs).
   Andere Dateien rufen nur C2F.api.* auf und kennen keine URLs. */
(function () {
  'use strict';
  var C2F = window.C2F;
  var TOKEN_KEY = 'c2f-token', USER_KEY = 'c2f-user';

  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) {
    try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
  }

  /* Fehlermeldungen des Backends (Englisch) auf Deutsch */
  var TEXT = {
    'Invalid email or password': 'E-Mail oder Passwort ist falsch.',
    'User already exists': 'Zu dieser E-Mail gibt es schon ein Konto.',
    'A valid email is required': 'Bitte eine gültige E-Mail-Adresse eingeben.',
    'Password must be at least 8 characters long': 'Das Passwort braucht mindestens 8 Zeichen.',
    'Authentication required': 'Bitte melde dich an.',
    'Authentication failed': 'Bitte melde dich an.',
    'Invalid or expired token': 'Deine Sitzung ist abgelaufen. Bitte melde dich neu an.',
    'Product not found': 'Produkt nicht gefunden.',
    'Product with this barcode already exists': 'Zu diesem Barcode gibt es schon ein Produkt.',
    'Barcode must contain only digits and be 8-14 characters long': 'Der Barcode muss aus 8 bis 14 Ziffern bestehen.',
    'Product name is required': 'Bitte einen Produktnamen eingeben.',
    'Internal server error': 'Der Server hat einen Fehler gemeldet. Bitte versuche es später noch einmal.'
  };
  var FIELD = { kcal: 'Energie', protein: 'Eiweiß', carbs: 'Kohlenhydrate', fat: 'Fett' };

  function translate(msg) {
    if (TEXT[msg]) return TEXT[msg];
    var m = /^(kcal|protein|carbs|fat) must be a non-negative number$/.exec(msg);
    if (m) return 'Bitte für ' + FIELD[m[1]] + ' eine Zahl ab 0 eingeben.';
    return msg;
  }
  function makeError(status, msg) {
    var e = new Error(msg);
    e.status = status;
    return e;
  }

  var api = C2F.api = {};
  api.token = function () { return read(TOKEN_KEY); };
  api.user = function () {
    try { return JSON.parse(read(USER_KEY) || 'null'); } catch (e) { return null; }
  };
  api.logout = function () {
    write(TOKEN_KEY, null);
    write(USER_KEY, null);
    location.replace('login.html');
  };
  function saveSession(res) {
    write(TOKEN_KEY, res.token);
    write(USER_KEY, JSON.stringify(res.user));
    return res.user;
  }

  function request(method, path, body, noAuth) {
    var headers = { Accept: 'application/json' };
    var token = api.token();
    if (token && !noAuth) headers.Authorization = 'Bearer ' + token;
    var init = { method: method, headers: headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    return fetch(C2F.API_BASE + path, init).then(function (res) {
      return res.text().then(function (txt) {
        var data = null;
        if (txt) { try { data = JSON.parse(txt); } catch (e) {} }
        if (res.ok) return data;
        if (res.status === 401 && !noAuth) {
          write(TOKEN_KEY, null);
          write(USER_KEY, null);
          location.replace('login.html?expired=1');
        }
        throw makeError(res.status, translate((data && data.error) || ('Fehler ' + res.status)));
      });
    }, function () {
      throw makeError(0, 'Der Server ist nicht erreichbar. Läuft das Backend (npm start im Ordner backend)? Adresse: ' + C2F.API_BASE);
    });
  }

  /* Anmeldung */
  api.login = function (email, password) {
    return request('POST', '/auth/login', { email: email, password: password }, true).then(saveSession);
  };
  api.register = function (email, password) {
    return request('POST', '/auth/register', { email: email, password: password }, true).then(saveSession);
  };
  api.me = function () { return request('GET', '/auth/me'); };
  api.health = function () { return request('GET', '/health', undefined, true); };

  /* Produkte */
  api.searchProducts = function (search, limit, offset) {
    var qs = 'limit=' + (limit || 20) + '&offset=' + (offset || 0);
    if (search) qs = 'search=' + encodeURIComponent(search) + '&' + qs;
    return request('GET', '/products?' + qs);
  };
  /* liefert das Produkt oder null, wenn der Barcode unbekannt ist */
  api.productByBarcode = function (barcode) {
    return request('GET', '/products/' + encodeURIComponent(barcode)).then(null, function (err) {
      if (err.status === 404) return null;
      throw err;
    });
  };
  api.createProduct = function (product) { return request('POST', '/products', product); };

  /* Produkt aus der API in die Form, die die Oberfläche benutzt */
  C2F.mapProduct = function (p) {
    return {
      id: p.id,
      bc: p.barcode,
      name: p.name,
      brand: p.brand || '',
      k: Number(p.kcal),
      p: Number(p.protein),
      c: Number(p.carbs),
      f: Number(p.fat)
    };
  };

  /* Zugangsschutz: alle Seiten außer login.html brauchen eine Anmeldung */
  C2F.onLoginPage = /login\.html$/.test(location.pathname);
  if (!C2F.onLoginPage && !api.token()) {
    C2F.halt = true;
    location.replace('login.html');
  }
})();
