/* util.js – kleine Helfer und Icons, die alle Seiten benutzen. */
(function () {
  'use strict';
  var C2F = window.C2F = window.C2F || {};

  C2F.pad = function (n) { return String(n).padStart(2, '0'); };
  C2F.dk = function (d) { return d.getFullYear() + '-' + C2F.pad(d.getMonth() + 1) + '-' + C2F.pad(d.getDate()); };
  C2F.dayKey = function (off) { var d = new Date(); d.setDate(d.getDate() - off); return C2F.dk(d); };
  C2F.dateOf = function (key) { var a = key.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); };
  C2F.fmt = function (n, d) {
    return Number(n).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  };
  C2F.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  C2F.num = function (v, lo, hi, d) {
    v = parseFloat(v);
    return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  };
  C2F.$ = function (s) { return document.querySelector(s); };

  C2F.icons = {
    X: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    TRI: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none" aria-hidden="true"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/></svg>',
    SCAN: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/></svg>',
    CHL: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    CHR: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    star: function (on) {
      return '<svg viewBox="0 0 24 24" width="20" height="20" fill="' + (on ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/></svg>';
    }
  };
})();
