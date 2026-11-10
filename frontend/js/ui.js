/* ui.js – gemeinsame Bausteine der Oberfläche: Hinweis-Toast, Warnboxen, Makro-Balken, Mahlzeitenliste. */
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

  /* Füllt die statischen Makro-Balken einer Seite: IDs <prefix>-p-val, <prefix>-p-bar usw. */
  C2F.setMacros = function (prefix, t, tg) {
    ['p', 'c', 'f'].forEach(function (k) {
      $('#' + prefix + '-' + k + '-val').textContent = fmt(t[k]) + ' / ' + fmt(tg[k]) + ' g';
      $('#' + prefix + '-' + k + '-bar').style.width = (tg[k] > 0 ? Math.min(100, t[k] / tg[k] * 100) : 0) + '%';
    });
  };

  /* Tagebuch eines Tages, gruppiert nach Mahlzeit */
  C2F.mealList = function (key, canAdd) {
    var es = C2F.logAll().filter(function (e) { return e.d === key; }), h = '';
    C2F.MEALS.forEach(function (mn, mi) {
      var list = es.filter(function (e) { return e.m === mi; });
      var sum = list.reduce(function (a, e) { return a + C2F.nut(e).k; }, 0);
      h += '<section class="meal"><div class="meal-h"><h2>' + mn + '</h2><span class="mono sub">' + (list.length ? fmt(sum) + ' kcal' : '') + '</span></div>';
      if (!list.length) h += '<p class="empty">Noch nichts eingetragen.</p>';
      list.forEach(function (e) {
        var n = C2F.nut(e);
        h += '<div class="ent"><div><b>' + esc(e.snap.name) + '</b><small>' + fmt(e.g) + ' g · E ' + fmt(n.p) + ' · KH ' + fmt(n.c) + ' · F ' + fmt(n.f) + ' g</small></div><span class="mono">' + fmt(n.k) + '</span><button class="icon-btn" data-act="del" data-id="' + esc(e.id) + '" aria-label="' + esc(e.snap.name) + ' entfernen">' + C2F.icons.X + '</button></div>';
      });
      if (canAdd) h += '<a class="link" href="produkte.html?meal=' + mi + '">+ Hinzufügen</a>';
      h += '</section>';
    });
    return h;
  };

  /* Löschen-Knöpfe in einem Container; after() zeichnet die Seite neu */
  C2F.bindDelete = function (el, after) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act="del"]');
      if (!b) return;
      var id = b.dataset.id, S = C2F.S;
      S.ue = S.ue.filter(function (x) { return x.id !== id; });
      C2F.save();
      after();
      C2F.toast('Eintrag entfernt.');
    });
  };
})();
