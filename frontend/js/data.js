/* data.js – feste Werte der Oberfläche und die simulierten Scan-Daten.
   Produkte kommen nicht mehr von hier, sondern aus dem Backend (api.js). */
(function () {
  'use strict';
  var C2F = window.C2F;

  C2F.MEALS = ['Frühstück', 'Mittagessen', 'Abendessen', 'Snack'];
  C2F.WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  C2F.ACT = [
    { l: 'Kaum Bewegung', f: 1.2 },
    { l: 'Leicht aktiv (1–3 Trainings pro Woche)', f: 1.375 },
    { l: 'Mäßig aktiv (3–5 Trainings pro Woche)', f: 1.55 },
    { l: 'Sehr aktiv (6–7 Trainings pro Woche)', f: 1.725 }
  ];
  C2F.MODELS = { '16:8': 16, '18:6': 18, '20:4': 20, 'Ramadan': 0 };

  /* Simulierter Scan, solange die Kamera nicht angebunden ist.
     Die ersten beiden Barcodes stammen aus backend/scripts/seed.js (Greek Yogurt, Banana),
     die anderen sind unbekannt und führen in den Ablauf "neues Produkt". */
  C2F.SIM_BC = ['12345678', '99887766', '56789012', '55667788'];
  C2F.OCR = [
    { k: 362, f: 6.2, c: 63, p: 10.1, flag: 'c' },
    { k: 63, f: 0.2, c: 4, p: 11, flag: 'k' },
    { k: 98, f: 3.2, c: 12.5, p: 4.1, flag: null }
  ];
})();
