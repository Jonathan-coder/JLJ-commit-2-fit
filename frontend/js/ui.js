/* ui.js – gemeinsame Bausteine der Oberfläche: Hinweis-Toast, Warnboxen, Lade- und Fehleranzeige, Makro-Balken, Mahlzeitenliste. */
(function () {
  'use strict';
  var C2F = window.C2F, $ = C2F.$, fmt = C2F.fmt, esc = C2F.esc, toastT = null;

  C2F.toast = function (msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; }, 2800);
  };
  /* Hinweis, der nach einem Seitenwechsel angezeigt wird */
  C2F.flashToast = function (msg) { try { sessionStorage.setItem('c2f-toast', msg); } catch (e) {} };
  C2F.showFlash = function () {
    try {
      var m = sessionStorage.getItem('c2f-toast');
      if (m) { sessionStorage.removeItem('c2f-toast'); C2F.toast(m); }
    } catch (e) {}
  };

  C2F.alertHTML = function (a) {
    return '<div class="alert ' + a.lv + '" role="status">' + C2F.icons.TRI + '<span>' + esc(a.txt) + '</span></div>';
  };

  /* Ladeanzeige und Fehleranzeige mit "Erneut versuchen" für Daten vom Server (T094, T096) */
  C2F.loadingHTML = function () { return '<p class="loading" role="status">Wird geladen …</p>'; };
  C2F.errorHTML = function (msg) {
    return '<div class="alert bad" role="alert">' + C2F.icons.TRI + '<span>' + esc(msg) + '</span></div>' +
      '<button class="btn block" type="button" data-act="retry">Erneut versuchen</button>';
  };
  /* Klick auf "Erneut versuchen" innerhalb von el ruft again() auf */
  C2F.bindRetry = function (el, again) {
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-act="retry"]')) again();
    });
  };

  /* Füllt die statischen Makro-Balken einer Seite: IDs <prefix>-p-val, <prefix>-p-bar usw. */
  C2F.setMacros = function (prefix, t, tg) {
    ['p', 'c', 'f'].forEach(function (k) {
      $('#' + prefix + '-' + k + '-val').textContent = fmt(t[k]) + ' / ' + fmt(tg[k]) + ' g';
      $('#' + prefix + '-' + k + '-bar').style.width = (tg[k] > 0 ? Math.min(100, t[k] / tg[k] * 100) : 0) + '%';
    });
  };

  /* Einträge eines Tages (Form von C2F.entryFromApi), gruppiert nach Mahlzeit */
  C2F.mealList = function (entries, canAdd) {
    var h = '';
    C2F.MEALS.forEach(function (mn, mi) {
      var list = entries.filter(function (e) { return e.m === mi; });
      var sum = list.reduce(function (a, e) { return a + e.n.k; }, 0);
      h += '<section class="meal"><div class="meal-h"><h2>' + mn + '</h2><span class="mono sub">' + (list.length ? fmt(sum) + ' kcal' : '') + '</span></div>';
      if (!list.length) h += '<p class="empty">Noch nichts eingetragen.</p>';
      list.forEach(function (e) {
        var n = e.n;
        h += '<div class="ent"><div><b>' + esc(e.name) + '</b><small>' + fmt(e.g) + ' g · E ' + fmt(n.p) + ' · KH ' + fmt(n.c) + ' · F ' + fmt(n.f) + ' g</small></div><span class="mono">' + fmt(n.k) + '</span><button class="icon-btn" data-act="del" data-id="' + esc(e.id) + '" aria-label="' + esc(e.name) + ' entfernen">' + C2F.icons.X + '</button></div>';
      });
      if (canAdd) h += '<a class="link" href="produkte.html?meal=' + mi + '">+ Hinzufügen</a>';
      h += '</section>';
    });
    return h;
  };

  /* Löschen-Knöpfe in einem Container: DELETE /intake/:id, danach lädt after() die Seite neu.
     Auch bei einem Fehler (zum Beispiel "Eintrag existiert nicht mehr" nach dem Löschen auf einem anderen Gerät)
     wird neu geladen, damit die Anzeige zum Server passt. */
  C2F.bindDelete = function (el, after) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act="del"]');
      if (!b || b.disabled) return;
      b.disabled = true;
      C2F.api.deleteIntake(b.dataset.id).then(function () {
        C2F.toast('Eintrag entfernt.');
        after();
      }, function (err) {
        C2F.toast(err.message);
        after();
      });
    });
  };
})();
