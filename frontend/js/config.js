/* config.js – Adresse des Backends.
   Standard: derselbe Rechner wie die Seite, Port 3000 (npm start im Ordner backend).
   Wird die Seite per Datei geöffnet (file://), gilt http://localhost:3000.
   Ändern ohne Code, in der Browser-Konsole:
     localStorage.setItem('c2f-api', 'http://192.168.0.10:3000')
   Zurücksetzen:
     localStorage.removeItem('c2f-api') */
(function () {
  'use strict';
  var C2F = window.C2F = window.C2F || {};

  var base = 'http://localhost:3000';
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    base = location.protocol + '//' + location.hostname + ':3000';
  }
  try {
    var custom = localStorage.getItem('c2f-api');
    if (custom) base = custom;
  } catch (e) {}

  C2F.API_BASE = base.replace(/\/+$/, '');
})();
