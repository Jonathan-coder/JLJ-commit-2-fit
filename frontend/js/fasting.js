/* fasting.js – Berechnung des Fasten-Timers (F07) ohne DOM, damit sie getestet werden kann.
   Ramadan (T077, Feedback 20.11.2026): Fasten nur zwischen dem ersten und dem letzten Ramadan-Tag,
   jeweils von Beginn (Fajr) bis Ende (Maghrib). Vorher zählt der Timer bis zum ersten Fastentag herunter. */
(function () {
  'use strict';
  var C2F = window.C2F;
  var DAY = 864e5;

  /* Zeitpunkt (ms) eines Tages 'JJJJ-MM-TT' um 'HH:MM' Ortszeit */
  C2F.at = function (dayKey, hhmm) {
    var d = C2F.dateOf(dayKey), t = hhmm.split(':').map(Number);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), t[0], t[1]).getTime();
  };

  /* Anzahl Kalendertage von a bis b ('JJJJ-MM-TT'); gerundet wegen Sommer-/Winterzeit */
  C2F.daysBetween = function (a, b) {
    return Math.round((C2F.dateOf(b) - C2F.dateOf(a)) / DAY);
  };

  function ramadan(F, now) {
    if (!(F.endDate >= F.startDate)) return { invalid: 'dates' };
    var today = C2F.dk(new Date(now));
    var a = C2F.at(today, F.from), b = C2F.at(today, F.to);
    if (!(b > a)) return { invalid: 'times' };

    var first = C2F.at(F.startDate, F.from), last = C2F.at(F.endDate, F.to);
    var days = C2F.daysBetween(F.startDate, F.endDate) + 1;
    if (now < first) return { phase: 'before', remain: first - now, start: first, days: days };
    if (now >= last) return { phase: 'after', end: last, days: days };

    var day = C2F.daysBetween(F.startDate, today) + 1;
    if (now >= a && now < b) {
      return { phase: 'fast', total: b - a, elapsed: now - a, remain: b - now, from: a, to: b, day: day, days: days };
    }
    var nextA = now < a ? a : a + DAY, prevB = now >= b ? b : b - DAY;
    return { phase: 'eat', total: nextA - prevB, elapsed: now - prevB, remain: nextA - now, nextA: nextA, day: day, days: days };
  }

  /* Zustand des Timers für die Einstellungen F (S.fast) zum Zeitpunkt now (ms).
     phase: idle | fast | done | eat | before | after; invalid: 'dates' | 'times' bei falschen Eingaben */
  C2F.fastState = function (F, now) {
    if (F.model === 'Ramadan') return ramadan(F, now);
    var total = C2F.MODELS[F.model] * 3600e3;
    if (!F.startTs) return { phase: 'idle', total: total };
    var el = now - F.startTs;
    if (el >= total) return { phase: 'done', total: total, elapsed: total, remain: 0, over: el - total };
    return { phase: 'fast', total: total, elapsed: el, remain: total - el, from: F.startTs, to: F.startTs + total };
  };
})();
