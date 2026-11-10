/* profil.js – Seite "Profil" (profil.html): Konto, Körperdaten, berechnetes Tagesziel (F06), Verbindung zum Backend. */
(function () {
  'use strict';
  if (window.C2F && window.C2F.halt) return;
  var C2F = window.C2F, $ = C2F.$, fmt = C2F.fmt, S = C2F.S, api = C2F.api;

  function fill() {
    document.querySelectorAll('[data-pr]').forEach(function (el) { el.value = String(S.profile[el.dataset.pr]); });
  }
  function drawTargets() {
    var tg = C2F.targets();
    $('#tgKcal').textContent = fmt(tg.k);
    $('#tgBmr').textContent = fmt(tg.bmr) + ' kcal';
    $('#tgTdee').textContent = fmt(tg.tdee) + ' kcal';
    $('#tgP').textContent = fmt(tg.p) + ' g';
    $('#tgC').textContent = fmt(tg.c) + ' g';
    $('#tgF').textContent = fmt(tg.f) + ' g';
  }

  document.addEventListener('input', function (e) {
    var t = e.target, k = t.dataset.pr;
    if (!k) return;
    var pr = S.profile;
    if (k === 'sex' || k === 'goal') pr[k] = t.value;
    else if (k === 'act') pr.act = Number(t.value);
    else { var n = parseFloat(t.value); if (isFinite(n)) pr[k] = n; }
    C2F.save();
    drawTargets();
  });
  $('#resetBtn').addEventListener('click', function () {
    C2F.resetState();
    fill();
    drawTargets();
    C2F.toast('Lokale Daten gelöscht.');
  });
  $('#logoutBtn').addEventListener('click', function () { api.logout(); });

  /* Konto und Verbindung */
  var u = api.user();
  $('#acctMail').textContent = u ? u.email : '–';
  $('#connUrl').textContent = C2F.API_BASE;
  $('#connState').textContent = 'wird geprüft …';
  api.health().then(function () {
    $('#connState').textContent = 'erreichbar';
  }, function () {
    $('#connState').textContent = 'nicht erreichbar';
  });

  fill();
  drawTargets();
  C2F.showFlash();
})();
