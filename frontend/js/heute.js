/* heute.js – Seite "Heute" (heute.html): Tagesbilanz, Makros, Mahlzeiten, Warnungen (F04, F06). */
(function () {
  'use strict';
  if (window.C2F && window.C2F.halt) return;
  var C2F = window.C2F, $ = C2F.$, fmt = C2F.fmt;
  var key = C2F.dayKey(0), reqId = 0;

  /* day = { totals, entries } von C2F.loadDiary */
  function render(day) {
    var t = day.totals, tg = C2F.targets(), ch = C2F.checks(t, tg, true);
    var pct = t.k / tg.k, C = 339.29, dash = Math.min(1, pct) * C, left = tg.k - t.k;
    var col = pct > 1.15 ? 'var(--bad)' : pct > 1 ? 'var(--warn)' : 'var(--accent)';

    $('#sum').hidden = false;
    $('#alerts').innerHTML = ch.map(C2F.alertHTML).join('');

    var bar = $('#ringBar');
    bar.style.stroke = col;
    bar.setAttribute('stroke-dasharray', dash + ' ' + C);
    bar.style.display = dash > 0.5 ? '' : 'none';

    $('#kcal').textContent = fmt(t.k);
    $('#kcalOf').textContent = 'von ' + fmt(tg.k) + ' kcal';
    $('#leftLabel').textContent = left >= 0 ? 'Noch offen' : 'Über dem Ziel';
    $('#left').textContent = fmt(Math.abs(left));
    $('#pct').textContent = Math.round(pct * 100) + ' % des Tagesziels';

    C2F.setMacros('m', t, tg);
    $('#meals').innerHTML = C2F.mealList(day.entries, true);
  }

  /* Tagebuch von heute vom Server holen (GET /diary?date=), mit Ladeanzeige und Fehlerfall */
  function load() {
    var my = ++reqId;
    $('#alerts').innerHTML = '';
    $('#meals').innerHTML = C2F.loadingHTML();
    C2F.loadDiary(key).then(function (day) {
      if (my === reqId) render(day);
    }, function (err) {
      if (my !== reqId) return;
      $('#sum').hidden = true;
      $('#meals').innerHTML = '';
      $('#alerts').innerHTML = C2F.errorHTML(err.message);
    });
  }

  $('#date').textContent = new Date().toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
  C2F.bindRetry($('#alerts'), load);
  C2F.bindDelete($('#meals'), load);
  load();
  C2F.showFlash();
})();
