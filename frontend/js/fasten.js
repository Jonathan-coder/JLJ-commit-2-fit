/* fasten.js – Seite "Fasten" (fasten.html): Timer für 16:8, 18:6, 20:4 und Ramadan (F07).
   Die Berechnung steht in fasting.js (C2F.fastState), hier nur die Anzeige. */
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
  function date(ts) { return new Date(ts).toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' }); }

  function setupStatic() {
    var F = S.fast, running = F.model !== 'Ramadan' && F.startTs && C2F.fastState(F, Date.now()).phase === 'fast';
    document.querySelectorAll('#models [data-m]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.m === F.model));
      b.disabled = !!running && b.dataset.m !== F.model;
    });
    $('#fDesc').textContent = F.model === 'Ramadan'
      ? 'Fasten von Sonnenaufgang bis Sonnenuntergang, vom ersten bis zum letzten Ramadan-Tag. Trage die Daten und Zeiten für deinen Ort ein. Vorgabe: Ramadan 2027 (voraussichtlich).'
      : MODELS[F.model] + ' Stunden fasten, ' + (24 - MODELS[F.model]) + ' Stunden essen.';
    $('#times').hidden = F.model !== 'Ramadan';
    $('#rs').value = F.startDate;
    $('#re').value = F.endDate;
    $('#rf').value = F.from;
    $('#rt').value = F.to;
    lastPhase = null;
    update();
  }

  function update() {
    var F = S.fast, st = C2F.fastState(F, Date.now()), frac = 0, col = 'var(--accent)', label = '', time = '', sub = '';
    var dayInfo = st.day ? 'Tag ' + st.day + ' von ' + st.days + ' · ' : '';
    if (st.invalid === 'dates') { label = 'Daten prüfen'; time = '--:--:--'; sub = 'Der letzte Ramadan-Tag darf nicht vor dem ersten liegen.'; }
    else if (st.invalid) { label = 'Zeiten prüfen'; time = '--:--:--'; sub = 'Das Ende muss nach dem Beginn liegen.'; }
    else if (st.phase === 'idle') { label = 'Bereit'; time = hms(st.total); sub = F.model + ': ' + MODELS[F.model] + ' Stunden fasten'; }
    else if (st.phase === 'before') {
      label = 'Ramadan beginnt in';
      time = st.remain >= 864e5 ? Math.floor(st.remain / 864e5) + ' Tagen' : hms(st.remain);
      sub = 'Erster Fastentag ' + date(st.start) + ', ab ' + clock(st.start) + ' Uhr · ' + st.days + ' Tage';
    }
    else if (st.phase === 'after') { frac = 1; col = 'var(--good)'; label = 'Ramadan beendet'; time = st.days + ' Tage'; sub = 'Letzter Fastentag war der ' + date(st.end) + '.'; }
    else if (st.phase === 'fast') { frac = st.elapsed / st.total; label = 'Noch bis zum Ende'; time = hms(st.remain); sub = dayInfo + 'Seit ' + clock(st.from) + ' Uhr · Ende ' + clock(st.to) + ' Uhr'; }
    else if (st.phase === 'eat') { frac = st.elapsed / st.total; col = 'var(--c)'; label = 'Essensfenster'; time = hms(st.remain); sub = dayInfo + 'Nächstes Fasten um ' + clock(st.nextA) + ' Uhr'; }
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

  /* Eingaben Ramadan: Daten (rs, re) und Uhrzeiten (rf, rt) */
  var FIELDS = { rs: ['startDate', /^\d{4}-\d{2}-\d{2}$/], re: ['endDate', /^\d{4}-\d{2}-\d{2}$/], rf: ['from', /^\d\d:\d\d$/], rt: ['to', /^\d\d:\d\d$/] };
  Object.keys(FIELDS).forEach(function (id) {
    $('#' + id).addEventListener('input', function (e) {
      if (FIELDS[id][1].test(e.target.value)) { S.fast[FIELDS[id][0]] = e.target.value; C2F.save(); lastPhase = null; update(); }
    });
  });

  setupStatic();
  setInterval(update, 1000);
  C2F.showFlash();
})();
