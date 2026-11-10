/* fasten.js – Seite "Fasten" (fasten.html): Timer für 16:8, 18:6, 20:4 und Ramadan (F07). */
(function () {
  'use strict';
  if (window.C2F && window.C2F.halt) return;
  var C2F = window.C2F, $ = C2F.$, S = C2F.S, pad = C2F.pad, MODELS = C2F.MODELS;
  var lastPhase = null, RING = 552.92;

  function hms(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60);
  }
  function clock(ts) { return new Date(ts).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }); }

  function fastState() {
    var F = S.fast, now = Date.now(), H = MODELS[F.model];
    if (F.model === 'Ramadan') {
      var a1 = F.from.split(':').map(Number), b1 = F.to.split(':').map(Number), d = new Date();
      var a = new Date(d.getFullYear(), d.getMonth(), d.getDate(), a1[0], a1[1]).getTime();
      var b = new Date(d.getFullYear(), d.getMonth(), d.getDate(), b1[0], b1[1]).getTime();
      if (!(b > a)) return { invalid: true };
      if (now >= a && now < b) return { phase: 'fast', total: b - a, elapsed: now - a, remain: b - now, from: a, to: b };
      var nextA = now < a ? a : a + 864e5, prevB = now >= b ? b : b - 864e5;
      return { phase: 'eat', total: nextA - prevB, elapsed: now - prevB, remain: nextA - now, nextA: nextA };
    }
    var total = H * 3600e3;
    if (!F.startTs) return { phase: 'idle', total: total };
    var el = now - F.startTs;
    if (el >= total) return { phase: 'done', total: total, elapsed: total, remain: 0, over: el - total };
    return { phase: 'fast', total: total, elapsed: el, remain: total - el, from: F.startTs, to: F.startTs + total };
  }

  function setupStatic() {
    var F = S.fast, running = F.model !== 'Ramadan' && F.startTs && fastState().phase === 'fast';
    document.querySelectorAll('#models [data-m]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.m === F.model));
      b.disabled = !!running && b.dataset.m !== F.model;
    });
    $('#fDesc').textContent = F.model === 'Ramadan'
      ? 'Fasten von Sonnenaufgang bis Sonnenuntergang. Trage die Zeiten für deinen Ort ein.'
      : MODELS[F.model] + ' Stunden fasten, ' + (24 - MODELS[F.model]) + ' Stunden essen.';
    $('#times').hidden = F.model !== 'Ramadan';
    $('#rf').value = F.from;
    $('#rt').value = F.to;
    lastPhase = null;
    update();
  }

  function update() {
    var F = S.fast, st = fastState(), frac = 0, col = 'var(--accent)', label = '', time = '', sub = '';
    if (st.invalid) { label = 'Zeiten prüfen'; time = '--:--:--'; sub = 'Das Ende muss nach dem Beginn liegen.'; }
    else if (st.phase === 'idle') { label = 'Bereit'; time = hms(st.total); sub = F.model + ': ' + MODELS[F.model] + ' Stunden fasten'; }
    else if (st.phase === 'fast') { frac = st.elapsed / st.total; label = 'Noch bis zum Ende'; time = hms(st.remain); sub = 'Seit ' + clock(st.from) + ' Uhr · Ende ' + clock(st.to) + ' Uhr'; }
    else if (st.phase === 'eat') { frac = st.elapsed / st.total; col = 'var(--c)'; label = 'Essensfenster'; time = hms(st.remain); sub = 'Nächstes Fasten um ' + clock(st.nextA) + ' Uhr'; }
    else { frac = 1; col = 'var(--good)'; label = 'Ziel erreicht'; time = '+' + hms(st.over); sub = MODELS[F.model] + ' Stunden geschafft'; }

    var ring = $('#fRing');
    ring.style.stroke = col;
    ring.setAttribute('stroke-dasharray', (Math.min(1, frac) * RING) + ' ' + RING);
    $('#fLabel').textContent = label;
    $('#fTime').textContent = time;
    $('#fSub').textContent = sub;

    var key = st.invalid ? 'invalid' : st.phase;
    if (key !== lastPhase) {
      lastPhase = key;
      var timer = F.model !== 'Ramadan';
      $('#bStart').hidden = !(timer && key === 'idle');
      var stop = $('#bStop');
      stop.hidden = !(timer && (key === 'fast' || key === 'done'));
      stop.textContent = key === 'done' ? 'Neu starten' : 'Fasten beenden';
      stop.className = key === 'done' ? 'btn primary block' : 'btn block';
    }
  }

  $('#models').addEventListener('click', function (e) {
    var b = e.target.closest('[data-m]');
    if (!b || b.disabled) return;
    S.fast.model = b.dataset.m; C2F.save(); setupStatic();
  });
  $('#bStart').addEventListener('click', function () { S.fast.startTs = Date.now(); C2F.save(); setupStatic(); });
  $('#bStop').addEventListener('click', function () { S.fast.startTs = null; C2F.save(); setupStatic(); });
  ['rf', 'rt'].forEach(function (id) {
    $('#' + id).addEventListener('input', function (e) {
      if (/^\d\d:\d\d$/.test(e.target.value)) { S.fast[id === 'rf' ? 'from' : 'to'] = e.target.value; C2F.save(); update(); }
    });
  });

  setupStatic();
  setInterval(update, 1000);
  C2F.showFlash();
})();
