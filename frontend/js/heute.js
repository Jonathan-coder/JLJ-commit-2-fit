/* heute.js – Seite "Heute" (heute.html): Tagesbilanz, Makros, Mahlzeiten, Warnungen (F04, F06). */
(function () {
  'use strict';
  if (window.C2F && window.C2F.halt) return;
  var C2F = window.C2F, $ = C2F.$, fmt = C2F.fmt;

  function render() {
    var key = C2F.dayKey(0), t = C2F.dayTotals(key), tg = C2F.targets(), ch = C2F.checks(t, tg, true);
    var pct = t.k / tg.k, C = 339.29, dash = Math.min(1, pct) * C, left = tg.k - t.k;
    var col = pct > 1.15 ? 'var(--bad)' : pct > 1 ? 'var(--warn)' : 'var(--accent)';

    $('#date').textContent = new Date().toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
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
    $('#meals').innerHTML = C2F.mealList(key, true);
  }

  C2F.bindDelete($('#meals'), render);
  render();
  C2F.showFlash();
})();
