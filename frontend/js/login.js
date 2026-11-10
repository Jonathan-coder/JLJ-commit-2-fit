/* login.js – Seite "Anmelden" (login.html): Login und Registrierung (F11) über POST /auth/login und /auth/register. */
(function () {
  'use strict';
  var C2F = window.C2F, $ = C2F.$, api = C2F.api;
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var mode = 'login', busy = false;

  /* schon angemeldet: direkt weiter */
  if (api.token()) { location.replace('heute.html'); return; }

  function draw() {
    var reg = mode === 'register';
    $('#btnLogin').setAttribute('aria-pressed', String(!reg));
    $('#btnRegister').setAttribute('aria-pressed', String(reg));
    $('#authTitle').textContent = reg ? 'Konto erstellen' : 'Willkommen zurück';
    $('#submit').textContent = reg ? 'Registrieren' : 'Anmelden';
    $('#password').setAttribute('autocomplete', reg ? 'new-password' : 'current-password');
    $('#pwHint').hidden = !reg;
    msg('');
  }
  function msg(text) { $('#msg').textContent = text; }

  $('#btnLogin').addEventListener('click', function () { mode = 'login'; draw(); });
  $('#btnRegister').addEventListener('click', function () { mode = 'register'; draw(); });

  $('#authForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    var email = $('#email').value.trim(), pw = $('#password').value;
    if (!EMAIL.test(email)) return msg('Bitte eine gültige E-Mail-Adresse eingeben.');
    if (!pw) return msg('Bitte ein Passwort eingeben.');
    if (mode === 'register' && pw.length < 8) return msg('Das Passwort braucht mindestens 8 Zeichen.');
    busy = true;
    $('#submit').disabled = true;
    msg(mode === 'register' ? 'Konto wird erstellt …' : 'Anmeldung läuft …');
    (mode === 'register' ? api.register : api.login)(email, pw).then(function () {
      location.replace('heute.html');
    }, function (err) {
      busy = false;
      $('#submit').disabled = false;
      msg(err.message);
    });
  });

  draw();
  if (new URLSearchParams(location.search).get('expired')) msg('Deine Sitzung ist abgelaufen. Bitte melde dich neu an.');
})();
