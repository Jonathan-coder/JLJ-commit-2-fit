/* state.js – lokaler Zustand (localStorage, pro Konto), Berechnungen und Laden des Tagebuchs.
   Das Tagebuch liegt seit T094-T096 auf dem Server (GET /diary, GET /diary/totals, POST/DELETE /intake).
   Vorerst lokal bleiben Profil (bis es /profile gibt, T097), Favoriten, zuletzt benutzte Produkte und Fasten-Timer. */
(function () {
  'use strict';
  var C2F = window.C2F;
  var user = C2F.api.user();
  var KEY = 'commit2fit-v2-' + (user ? user.id : 'anon');

  /* Ramadan-Vorgabe (T077): Ramadan 2027, voraussichtlich 8.2. bis 9.3.2027. Der genaue Beginn hängt
     von der Mondsichtung ab, deshalb kann man die Daten auf der Seite Fasten ändern. */
  var DEF = function () {
    return {
      profile: { sex: 'm', age: 22, h: 180, w: 75, act: 1, goal: 'halten' },
      favs: [],   /* Produkte (Kopie der API-Daten) */
      recent: [], /* zuletzt zum Tagebuch hinzugefügte Produkte, neueste zuerst (Filter "Zuletzt") */
      fast: { model: '16:8', startTs: null, from: '05:30', to: '18:00', startDate: '2027-02-08', endDate: '2027-03-09' }
    };
  };
  function load() {
    try {
      var j = JSON.parse(localStorage.getItem(KEY) || 'null');
      /* fast einzeln ergänzen: ältere Stände haben noch kein startDate/endDate (T077) */
      if (j && j.profile && j.fast) { var d = DEF(); j.fast = Object.assign(d.fast, j.fast); return Object.assign(d, j); }
    } catch (e) {}
    return DEF();
  }

  var S = C2F.S = load();
  C2F.save = function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  C2F.resetState = function () {
    Object.keys(S).forEach(function (k) { delete S[k]; });
    Object.assign(S, DEF());
    C2F.save();
  };

  /* Nährwerte von g Gramm eines Produkts (Werte im Produkt gelten pro 100 g) */
  C2F.nutP = function (p, g) {
    var f = g / 100;
    return { k: p.k * f, p: p.p * f, c: p.c * f, f: p.f * f };
  };

  /* Zuletzt benutzte Produkte: das Produkt kommt nach vorn, höchstens 10 bleiben */
  C2F.rememberRecent = function (p) {
    S.recent = [p].concat(S.recent.filter(function (r) { return r.id !== p.id; })).slice(0, 10);
    C2F.save();
  };

  /* ---------- Tagebuch vom Server (T094, T096) ---------- */

  C2F.zeroTotals = function () { return { k: 0, p: 0, c: 0, f: 0 }; };
  /* Summen der API { kcal, protein, carbs, fat } in die Kurzform der Oberfläche { k, p, c, f } */
  C2F.totalsFromApi = function (t) { return { k: t.kcal, p: t.protein, c: t.carbs, f: t.fat }; };
  /* Eintrag der API in die Form für die Mahlzeitenliste: n = Nährwerte des Eintrags (vom Server berechnet) */
  C2F.entryFromApi = function (e) {
    return { id: e.id, day: e.day, m: C2F.MEAL_KEYS.indexOf(e.meal), g: e.amountG, name: e.productName, n: C2F.totalsFromApi({ kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat }) };
  };
  /* Ein Tag: { day, totals, entries } mit allen Einträgen in der Reihenfolge der Mahlzeiten */
  C2F.diaryFromApi = function (d) {
    var entries = [];
    C2F.MEAL_KEYS.forEach(function (key) { entries = entries.concat(d.meals[key].map(C2F.entryFromApi)); });
    return { day: d.day, totals: C2F.totalsFromApi(d.totals), entries: entries };
  };
  C2F.loadDiary = function (day) { return C2F.api.diary(day).then(C2F.diaryFromApi); };
  /* Summen je Tag von bis einschließlich als Objekt { 'JJJJ-MM-TT': { k, p, c, f } }; Tage ohne Einträge fehlen */
  C2F.loadTotals = function (from, to) {
    return C2F.api.diaryTotals(from, to).then(function (r) {
      var byDay = {};
      r.days.forEach(function (d) { byDay[d.day] = C2F.totalsFromApi(d); });
      return byDay;
    });
  };

  /* Tagesziel nach Mifflin-St Jeor */
  C2F.targets = function () {
    var pr = S.profile, num = C2F.num;
    var age = num(pr.age, 12, 100, 22), h = num(pr.h, 120, 230, 180), w = num(pr.w, 35, 250, 75);
    var bmr = 10 * w + 6.25 * h - 5 * age + (pr.sex === 'm' ? 5 : -161);
    var tdee = bmr * C2F.ACT[pr.act].f;
    var adj = { abnehmen: -400, halten: 0, zunehmen: 300 }[pr.goal] || 0;
    var floor = pr.sex === 'm' ? 1500 : 1200;
    var k = Math.round(Math.max(tdee + adj, floor) / 10) * 10;
    var p = Math.round(w * 1.6), f = Math.round(k * 0.3 / 9);
    var c = Math.max(0, Math.round((k - p * 4 - f * 9) / 4));
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), k: k, p: p, c: c, f: f };
  };

  /* Warnlogik (F06): zu hoch ab 115 %, zu niedrig unter 70 % (heute erst ab 18 Uhr).
     Schwellen sind ein Vorschlag und mit dem PO noch nicht abgestimmt. */
  C2F.status = function (t, tg, today) {
    if (t.k <= 0) return 'none';
    if (t.k > tg.k * 1.15) return 'high';
    if ((!today || new Date().getHours() >= 18) && t.k < tg.k * 0.7) return 'low';
    return 'ok';
  };
  C2F.checks = function (t, tg, today) {
    var out = [], late = !today || new Date().getHours() >= 18, s = C2F.status(t, tg, today), fmt = C2F.fmt;
    if (s === 'high') out.push({ lv: 'bad', txt: 'Zu viel: ' + fmt(t.k - tg.k) + ' kcal über dem Tagesziel.' });
    if (s === 'low') out.push({ lv: 'warn', txt: 'Zu wenig: nur ' + Math.round(t.k / tg.k * 100) + ' % des Tagesziels erreicht.' });
    if (t.k > 0 && t.f > tg.f * 1.3) out.push({ lv: 'warn', txt: 'Der Fettanteil liegt deutlich über dem Ziel.' });
    if (t.k > 0 && late && t.p < tg.p * 0.6) out.push({ lv: 'warn', txt: 'Eiweiß liegt unter 60 % des Ziels.' });
    return out;
  };
  C2F.defMeal = function () {
    var h = new Date().getHours();
    return h < 10 ? 0 : h < 15 ? 1 : h < 17 ? 3 : 2;
  };
})();
