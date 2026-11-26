/* verlauf.js – Seite "Verlauf" (verlauf.html): Wochendiagramm und Tagesansicht (F05, F06).
   Die Daten kommen vom Server: Wochensummen mit GET /diary/totals, ein Tag mit GET /diary?date= (T096). */
(function () {
  'use strict';
  if (window.C2F && window.C2F.halt) return;
  var C2F = window.C2F, $ = C2F.$, fmt = C2F.fmt, esc = C2F.esc, WD = C2F.WD, I = C2F.icons;
  var hm = 'week', hk = C2F.dayKey(0), reqId = 0;
  var PILL = { ok: 'im Ziel', high: 'zu hoch', low: 'zu niedrig', none: 'keine Einträge' };

  function offsetOf(key) { return Math.round((C2F.dateOf(C2F.dayKey(0)) - C2F.dateOf(key)) / 864e5); }

  function chartSVG(days, tg) {
    var mx = Math.max.apply(null, [tg.k * 1.2].concat(days.map(function (x) { return x.t.k; })));
    var top = Math.max(1000, Math.ceil(mx / 500) * 500);
    var W = 340, H = 196, L = 36, R = 6, T = 18, B = 26, iw = W - L - R, ih = H - T - B, step = iw / 7, bw = step * 0.56;
    var y = function (v) { return T + ih - (v / top) * ih; };
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Kalorien der letzten sieben Tage im Vergleich zum Tagesziel von ' + fmt(tg.k) + ' kcal">';
    for (var v = 0; v <= top; v += 500) {
      s += '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
      if (v % 1000 === 0) s += '<text x="' + (L - 6) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + fmt(v) + '</text>';
    }
    days.forEach(function (x, idx) {
      var cx = L + step * idx + step / 2, h = (x.t.k / top) * ih;
      if (x.t.k > 0) {
        s += '<rect class="b-' + x.st + (x.o === 0 ? ' today' : '') + '" x="' + (cx - bw / 2) + '" y="' + y(x.t.k) + '" width="' + bw + '" height="' + h + '" rx="3"/>' +
             '<text x="' + cx + '" y="' + (y(x.t.k) - 4) + '" text-anchor="middle">' + fmt(x.t.k) + '</text>';
      }
      s += '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + (x.o === 0 ? 'Heute' : WD[x.d.getDay()]) + '</text>';
    });
    s += '<line class="tl" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(tg.k) + '" y2="' + y(tg.k) + '"/></svg>';
    return s;
  }

  /* byDay: { 'JJJJ-MM-TT': { k, p, c, f } } der letzten sieben Tage; Tage ohne Einträge fehlen */
  function weekRender(byDay) {
    var tg = C2F.targets(), days = [], o;
    for (o = 6; o >= 0; o--) {
      var key = C2F.dayKey(o);
      days.push({ o: o, key: key, d: C2F.dateOf(key), t: byDay[key] || C2F.zeroTotals() });
    }
    days.forEach(function (x) { x.st = C2F.status(x.t, tg, x.o === 0); });

    $('#chart').innerHTML = chartSVG(days, tg);
    $('#legTarget').textContent = 'Ziel ' + fmt(tg.k) + ' kcal';

    var done = days.filter(function (x) { return x.o > 0 && x.t.k > 0; }), n = done.length || 1;
    var avg = function (k) { return done.reduce(function (a, x) { return a + x.t[k]; }, 0) / n; };
    $('#aK').textContent = fmt(avg('k'));
    $('#aP').textContent = fmt(avg('p'));
    $('#aC').textContent = fmt(avg('c'));
    $('#aF').textContent = fmt(avg('f'));

    $('#dayList').innerHTML = days.slice().reverse().map(function (x) {
      var lab = x.d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' });
      return '<button class="drow" data-act="hday" data-key="' + x.key + '"><span class="d"><b>' + esc(lab) + (x.o === 0 ? ' (heute)' : '') + '</b><span class="sub mono">' + fmt(x.t.k) + ' kcal</span></span>' +
             '<span class="pill ' + x.st + '">' + (x.o === 0 && x.st === 'ok' ? 'läuft' : PILL[x.st]) + '</span>' + I.CHR + '</button>';
    }).join('');
  }

  /* day = { totals, entries } von C2F.loadDiary */
  function dayRender(day) {
    var off = offsetOf(hk), t = day.totals, tg = C2F.targets(), ch = C2F.checks(t, tg, off === 0);
    $('#dAlerts').innerHTML = ch.map(C2F.alertHTML).join('');
    $('#dKcal').textContent = fmt(t.k);
    $('#dTarget').textContent = 'Ziel ' + fmt(tg.k) + ' kcal';
    C2F.setMacros('d', t, tg);
    $('#dMeals').innerHTML = C2F.mealList(day.entries, false);
  }

  /* Daten der gewählten Ansicht vom Server holen; eine ältere Antwort wird verworfen, wenn inzwischen
     eine neuere Anfrage läuft (zum Beispiel beim schnellen Blättern zwischen den Tagen) */
  function render() {
    var w = hm === 'week', my = ++reqId, body = w ? $('#weekBody') : $('#dayBody'), state = w ? $('#weekState') : $('#dayState');
    $('#weekView').hidden = !w;
    $('#dayView').hidden = w;
    $('#btnWeek').setAttribute('aria-pressed', String(w));
    $('#btnDay').setAttribute('aria-pressed', String(!w));
    var off = offsetOf(hk);
    $('#dLabel').textContent = C2F.dateOf(hk).toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#dprev').disabled = off >= 6;
    $('#dnext').disabled = off <= 0;
    state.innerHTML = C2F.loadingHTML();
    body.hidden = true;
    var request = w ? C2F.loadTotals(C2F.dayKey(6), C2F.dayKey(0)) : C2F.loadDiary(hk);
    request.then(function (data) {
      if (my !== reqId) return;
      state.innerHTML = '';
      body.hidden = false;
      if (w) weekRender(data); else dayRender(data);
    }, function (err) {
      if (my !== reqId) return;
      state.innerHTML = C2F.errorHTML(err.message);
    });
  }

  $('#btnWeek').addEventListener('click', function () { hm = 'week'; render(); });
  $('#btnDay').addEventListener('click', function () { hm = 'day'; render(); });
  $('#dprev').addEventListener('click', function () { var o = offsetOf(hk); if (o < 6) { hk = C2F.dayKey(o + 1); render(); } });
  $('#dnext').addEventListener('click', function () { var o = offsetOf(hk); if (o > 0) { hk = C2F.dayKey(o - 1); render(); } });
  $('#dayList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act="hday"]');
    if (!b) return;
    hk = b.dataset.key; hm = 'day'; render(); window.scrollTo(0, 0);
  });
  C2F.bindRetry($('#weekState'), render);
  C2F.bindRetry($('#dayState'), render);
  C2F.bindDelete($('#dMeals'), render);

  render();
  C2F.showFlash();
})();
