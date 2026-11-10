/* state.js – lokaler Zustand (localStorage, pro Konto) und Berechnungen.
   Vorerst lokal, weil das Backend dafür noch keine Endpunkte hat:
   Tagebuch, Profil, Favoriten und Fasten-Timer.
   Sobald es sie gibt (siehe docs/architecture.md: Intake API, Profile API),
   werden die Zugriffe hier durch C2F.api-Aufrufe ersetzt. */
(function () {
  'use strict';
  var C2F = window.C2F;
  var user = C2F.api.user();
  var KEY = 'commit2fit-v2-' + (user ? user.id : 'anon');

  var DEF = function () {
    return {
      profile: { sex: 'm', age: 22, h: 180, w: 75, act: 1, goal: 'halten' },
      favs: [],   /* Produkte (Kopie der API-Daten) */
      fast: { model: '16:8', startTs: null, from: '05:30', to: '18:00' },
      ue: []      /* Tagebuch: { id, d: 'JJJJ-MM-TT', m: Mahlzeit 0-3, g: Gramm, snap: Produkt } */
    };
  };
  function load() {
    try {
      var j = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (j && j.profile && j.fast) return Object.assign(DEF(), j);
    } catch (e) {}
    return DEF();
  }

  var S = C2F.S = load();
  C2F.save = function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  C2F.resetState = function () {
    Object.keys(S).forEach(function (k) { delete S[k]; });
    Object.assign(S, DEF());
    C2F.save();
  };

  C2F.logAll = function () { return S.ue; };

  /* Nährwerte von g Gramm eines Produkts (Werte im Produkt gelten pro 100 g) */
  C2F.nutP = function (p, g) {
    var f = g / 100;
    return { k: p.k * f, p: p.p * f, c: p.c * f, f: p.f * f };
  };
  C2F.nut = function (e) { return C2F.nutP(e.snap, e.g); };

  C2F.dayTotals = function (key) {
    var t = { k: 0, p: 0, c: 0, f: 0 };
    S.ue.forEach(function (e) {
      if (e.d === key) {
        var n = C2F.nut(e);
        t.k += n.k; t.p += n.p; t.c += n.c; t.f += n.f;
      }
    });
    return t;
  };

  /* Tagesziel nach Mifflin-St Jeor */
  C2F.targets = function () {
    var pr = S.profile, num = C2F.num;
    var age = num(pr.age, 12, 100, 22), h = num(pr.h, 120, 230, 180), w = num(pr.w, 35, 250, 75);
    var bmr = 10 * w + 6.25 * h - 5 * age + (pr.sex === 'm' ? 5 : -161);
    var tdee = bmr * C2F.ACT[pr.act].f;
    var adj = { abnehmen: -400, halten: 0, zunehmen: 300 }[pr.goal] || 0;
    var floor = pr.sex === 'm' ? 1500 : 1200;
    var k = Math.round(Math.max(tdee + adj, floor) / 10) * 10;
    var p = Math.round(w * 1.6), f = Math.round(k * 0.3 / 9);
    var c = Math.max(0, Math.round((k - p * 4 - f * 9) / 4));
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), k: k, p: p, c: c, f: f };
  };

  /* Warnlogik (F06): zu hoch ab 115 %, zu niedrig unter 70 % (heute erst ab 18 Uhr).
     Schwellen sind ein Vorschlag und mit dem PO noch nicht abgestimmt. */
  C2F.status = function (t, tg, today) {
    if (t.k <= 0) return 'none';
    if (t.k > tg.k * 1.15) return 'high';
    if ((!today || new Date().getHours() >= 18) && t.k < tg.k * 0.7) return 'low';
    return 'ok';
  };
  C2F.checks = function (t, tg, today) {
    var out = [], late = !today || new Date().getHours() >= 18, s = C2F.status(t, tg, today), fmt = C2F.fmt;
    if (s === 'high') out.push({ lv: 'bad', txt: 'Zu viel: ' + fmt(t.k - tg.k) + ' kcal über dem Tagesziel.' });
    if (s === 'low') out.push({ lv: 'warn', txt: 'Zu wenig: nur ' + Math.round(t.k / tg.k * 100) + ' % des Tagesziels erreicht.' });
    if (t.k > 0 && t.f > tg.f * 1.3) out.push({ lv: 'warn', txt: 'Der Fettanteil liegt deutlich über dem Ziel.' });
    if (t.k > 0 && late && t.p < tg.p * 0.6) out.push({ lv: 'warn', txt: 'Eiweiß liegt unter 60 % des Ziels.' });
    return out;
  };
  C2F.defMeal = function () {
    var h = new Date().getHours();
    return h < 10 ? 0 : h < 15 ? 1 : h < 17 ? 3 : 2;
  };
})();
