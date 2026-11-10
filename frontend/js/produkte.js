/* produkte.js – Seite "Produkte" (produkte.html): Suche (F01), Produkt-Sheet, Scan-Ablauf (F02, F03).
   Produkte kommen aus dem Backend (GET /products, GET /products/:barcode, POST /products). */
(function () {
  'use strict';
  if (window.C2F && window.C2F.halt) return;
  var C2F = window.C2F, $ = C2F.$, fmt = C2F.fmt, esc = C2F.esc, S = C2F.S, MEALS = C2F.MEALS, I = C2F.icons, api = C2F.api;
  var BARCODE = /^\d{8,14}$/;
  var q = '', filt = 'all', pendMeal = null, cur = null, sc = null, simIdx = 0, ocrIdx = 0, lastFocus = null;
  var list = { items: [], total: 0, loading: false, error: '' }, reqId = 0, timer = null;
  var sheet = $('#sheet'), panel = $('#panel');

  /* produkte.html?meal=1 kommt von "+ Hinzufügen" auf der Seite Heute */
  var mp = new URLSearchParams(location.search).get('meal');
  if (mp !== null && /^[0-3]$/.test(mp)) {
    pendMeal = Number(mp);
    var ctx = $('#ctx');
    ctx.innerHTML = 'Eintrag für <b>' + MEALS[pendMeal] + '</b>';
    ctx.hidden = false;
  }

  /* ---------- Liste ---------- */
  function isFav(id) { return S.favs.some(function (f) { return f.id === id; }); }
  function filterLocal(arr) {
    var s = q.trim().toLowerCase();
    return s ? arr.filter(function (p) { return (p.name + ' ' + p.brand + ' ' + p.bc).toLowerCase().indexOf(s) >= 0; }) : arr;
  }
  function recent() {
    var seen = {}, out = [];
    S.ue.slice().sort(function (a, b) { return a.id < b.id ? 1 : -1; }).forEach(function (e) {
      if (!seen[e.snap.id]) { seen[e.snap.id] = true; out.push(e.snap); }
    });
    return out.slice(0, 10);
  }

  function load(reset) {
    var my = ++reqId, offset = reset ? 0 : list.items.length;
    list.loading = true;
    list.error = '';
    if (reset) { list.items = []; list.total = 0; }
    draw();
    api.searchProducts(q.trim(), 20, offset).then(function (r) {
      if (my !== reqId) return;
      list.loading = false;
      list.items = list.items.concat(r.items.map(C2F.mapProduct));
      list.total = r.total;
      draw();
    }, function (err) {
      if (my !== reqId) return;
      list.loading = false;
      list.error = err.message;
      draw();
    });
  }

  function rowHTML(p) {
    return '<li><button class="row" data-act="open" data-id="' + p.id + '"><span class="rm"><b>' + esc(p.name) + '</b><small>' + esc(p.brand || 'ohne Marke') + '</small></span>' +
      (isFav(p.id) ? '<span class="st" aria-label="Favorit">' + I.star(true) + '</span>' : '') +
      '<span class="kc">' + fmt(p.k) + ' kcal<br><small>pro 100 g</small></span></button></li>';
  }
  var SCAN_BTN = '<button class="btn primary" data-act="scan">' + I.SCAN + 'Produkt scannen</button>';

  function draw() {
    var el = $('#results'), count = $('#count'), items, h = '';
    document.querySelectorAll('[data-f]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.f === filt)); });

    if (filt === 'all') {
      items = list.items;
      if (list.error) {
        el.innerHTML = '<li><p class="msg" role="alert" style="margin-top:18px">' + esc(list.error) + '</p><button class="btn" data-act="retry">Erneut versuchen</button></li>';
        count.textContent = '';
        return;
      }
      if (list.loading && !items.length) {
        el.innerHTML = '<li><p class="empty" style="margin-top:18px">Produkte werden geladen …</p></li>';
        count.textContent = '';
        return;
      }
      if (!items.length) {
        el.innerHTML = '<li><p class="empty" style="margin-top:18px">' + (q.trim() ? 'Nichts gefunden. Scanne das Produkt, dann steht es für alle Nutzer in der zentralen Datenbank.' : 'Es sind noch keine Produkte in der Datenbank. Scanne das erste Produkt.') + '</p>' + SCAN_BTN + '</li>';
        count.textContent = '';
        return;
      }
      h = items.map(rowHTML).join('');
      if (items.length < list.total) {
        h += '<li style="padding-top:12px"><button class="btn block" data-act="more"' + (list.loading ? ' disabled' : '') + '>' + (list.loading ? 'Lädt …' : 'Mehr laden (' + items.length + ' von ' + list.total + ')') + '</button></li>';
      }
      el.innerHTML = h;
      count.textContent = list.total + (list.total === 1 ? ' Produkt' : ' Produkte') + ' in der zentralen Datenbank' + (q.trim() ? ' passend zur Suche.' : '.');
      return;
    }

    items = filterLocal(filt === 'fav' ? S.favs : recent());
    count.textContent = '';
    if (!items.length) {
      el.innerHTML = '<li><p class="empty" style="margin-top:18px">' + (q.trim() ? 'Nichts gefunden.' : filt === 'fav' ? 'Noch keine Favoriten. Tippe in einem Produkt auf den Stern.' : 'Noch nichts im Tagebuch. Hier erscheinen die zuletzt gegessenen Produkte.') + '</p></li>';
      return;
    }
    el.innerHTML = items.map(rowHTML).join('');
  }

  /* ---------- Sheet ---------- */
  function showSheet(html) {
    if (sheet.hidden) lastFocus = document.activeElement;
    panel.innerHTML = html;
    sheet.hidden = false;
    document.body.style.overflow = 'hidden';
    panel.scrollTop = 0;
    panel.focus();
  }
  function closeSheet() {
    sheet.hidden = true;
    document.body.style.overflow = '';
    cur = null; sc = null;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  /* ---------- Produkt-Sheet ---------- */
  function grams() {
    var v = parseFloat(String(cur.val).replace(',', '.'));
    return isFinite(v) && v > 0 ? v : 0;
  }
  function openProduct(p) {
    sc = null;
    cur = { p: p, val: 100, meal: pendMeal !== null ? pendMeal : C2F.defMeal() };
    showSheet(productHTML());
  }
  function calcHTML() {
    var g = grams(), n = C2F.nutP(cur.p, g);
    return '<div><span class="big">' + fmt(n.k) + '</span> <span class="sub">kcal · ' + fmt(g) + ' g</span></div>' +
      '<div class="mini"><span><i style="background:var(--p)"></i>Eiweiß <b class="mono">' + fmt(n.p, 1) + ' g</b></span>' +
      '<span><i style="background:var(--c)"></i>KH <b class="mono">' + fmt(n.c, 1) + ' g</b></span>' +
      '<span><i style="background:var(--f)"></i>Fett <b class="mono">' + fmt(n.f, 1) + ' g</b></span></div>';
  }
  function productHTML() {
    var p = cur.p, fav = isFav(p.id);
    var amt = '<label class="fld">Menge in Gramm<input class="in" id="pv" type="number" inputmode="decimal" min="1" step="5" value="' + esc(cur.val) + '"></label>' +
      '<div class="chips" style="margin:0">' + [50, 100, 150, 200].map(function (v) { return '<button class="chip" data-act="qg" data-v="' + v + '">' + v + ' g</button>'; }).join('') + '</div>' +
      '<label class="fld">Mahlzeit<select class="in" id="pm">' + MEALS.map(function (m, i) { return '<option value="' + i + '"' + (cur.meal === i ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></label>';
    return '<div class="sh-head"><div><h2 id="sheetTitle">' + esc(p.name) + '</h2><p class="sub">' + esc(p.brand || 'ohne Marke') + ' · <span class="mono">' + esc(p.bc) + '</span></p></div><button class="icon-btn" data-act="close" aria-label="Schließen">' + I.X + '</button></div>' +
      '<div class="label"><h3>Nährwerte <span>pro 100 g</span></h3>' +
      '<div class="lr first"><span>Energie</span><span class="mono">' + fmt(p.k) + ' kcal</span></div>' +
      '<div class="lr"><span>Fett</span><span class="mono">' + fmt(p.f, 1) + ' g</span></div>' +
      '<div class="lr"><span>Kohlenhydrate</span><span class="mono">' + fmt(p.c, 1) + ' g</span></div>' +
      '<div class="lr"><span>Eiweiß</span><span class="mono">' + fmt(p.p, 1) + ' g</span></div></div>' +
      '<div class="amount">' + amt + '</div><div class="calc" id="pcalc">' + calcHTML() + '</div>' +
      '<div class="acts"><button class="btn" data-act="fav" aria-pressed="' + fav + '" aria-label="' + (fav ? 'Favorit entfernen' : 'Als Favorit merken') + '" style="color:' + (fav ? 'var(--c)' : 'inherit') + '">' + I.star(fav) + '</button><button class="btn primary" data-act="addcur">Zum Tagebuch hinzufügen</button></div>';
  }

  /* ---------- Scan-Sheet ---------- */
  function stepper(n) {
    return '<ol class="steps">' + ['Barcode', 'Nährwerte', 'Prüfen'].map(function (l, i) {
      return '<li class="' + (i + 1 < n ? 'done' : '') + '"' + (i + 1 === n ? ' aria-current="step"' : '') + '><span>' + (i + 1) + '</span>' + l + '</li>';
    }).join('') + '</ol>';
  }
  function scanHTML() {
    var head = '<div class="sh-head"><h2 id="sheetTitle">Produkt scannen</h2><button class="icon-btn" data-act="close" aria-label="Schließen">' + I.X + '</button></div>' + stepper(sc.step);
    var proto = '<p class="sub" style="margin-top:12px">Die Kamera ist noch nicht angebunden. "Scan" liefert Demo-Barcodes, die Suche im Backend ist echt.</p>';
    var corners = '<i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i>';
    if (sc.step === 1) {
      return head + '<div class="vf" aria-hidden="true">' + corners + '<div class="bars"></div></div>' +
        '<button class="btn primary block" data-act="scanbc">' + I.SCAN + 'Barcode scannen (Demo)</button>' +
        '<p class="or">oder Barcode eintippen</p><div class="searchrow"><label for="bcIn" class="sr-only">Barcode</label><input class="in mono" id="bcIn" inputmode="numeric" maxlength="14" placeholder="8 bis 14 Ziffern"><button class="btn" data-act="scanmanual">Suchen</button></div>' +
        '<p class="msg" id="scMsg" role="alert"></p>' + proto;
    }
    if (sc.step === 2) {
      return head + '<p style="margin:0 0 12px">Der Barcode <span class="mono">' + esc(sc.bc) + '</span> ist noch nicht in der Datenbank. Fotografiere jetzt die Nährwerttabelle.</p>' +
        '<div class="vf" aria-hidden="true">' + corners + '<div class="lbl"><i></i><i></i><i></i><i></i><i></i></div></div>' +
        '<button class="btn primary block" data-act="scanocr">' + I.SCAN + 'Nährwerttabelle scannen (Demo)</button>' +
        '<div style="margin-top:8px"><button class="link" data-act="scanback">Zurück</button></div>' + proto;
    }
    var v = sc.vals;
    function f(key, label) {
      return '<label class="fld' + (sc.flag === key ? ' flag' : '') + '">' + label + '<input class="in mono" data-sf="' + key + '" inputmode="decimal" value="' + esc(v[key]) + '">' +
        (sc.flag === key ? '<span class="hint">Unsicher erkannt, bitte prüfen</span>' : '') + '</label>';
    }
    return head + '<p class="sub" style="margin:0 0 12px">Prüfe die erkannten Werte (pro 100 g) und ergänze den Namen.</p><div class="form">' +
      '<label class="fld">Produktname<input class="in" data-sf="name" value="' + esc(v.name) + '" placeholder="z. B. Dinkel-Müsli" autocomplete="off"></label>' +
      '<div class="grid2"><label class="fld">Marke<input class="in" data-sf="brand" value="' + esc(v.brand) + '" autocomplete="off"></label><label class="fld">Barcode<input class="in mono" data-sf="bc" inputmode="numeric" maxlength="14" value="' + esc(v.bc) + '"></label></div>' +
      '<div class="grid2">' + f('k', 'Energie (kcal)') + f('f', 'Fett (g)') + f('c', 'Kohlenhydrate (g)') + f('p', 'Eiweiß (g)') + '</div></div>' +
      '<p class="msg" id="scMsg" role="alert"></p>' +
      '<div class="acts" style="margin-top:6px"><button class="btn" data-act="rescan">Neu scannen</button><button class="btn primary" data-act="savep">In Datenbank speichern</button></div>';
  }
  function scMsg(t) { var m = $('#scMsg'); if (m) m.textContent = t; }
  function setBusy(on, msg) {
    if (sc) sc.busy = on;
    panel.querySelectorAll('button[data-act]').forEach(function (b) { if (b.dataset.act !== 'close') b.disabled = on; });
    if (msg !== undefined) scMsg(msg);
  }

  /* Barcode im Backend nachschlagen: bekannt -> Produkt öffnen, unbekannt -> Nährwerte erfassen */
  function lookup(bc) {
    if (!BARCODE.test(bc)) return scMsg('Der Barcode muss aus 8 bis 14 Ziffern bestehen.');
    setBusy(true, 'Suche im Backend …');
    api.productByBarcode(bc).then(function (p) {
      if (!sc) return;
      if (p) {
        C2F.toast('Dieses Produkt ist schon in der Datenbank.');
        openProduct(C2F.mapProduct(p));
      } else {
        sc.bc = bc; sc.step = 2; sc.busy = false;
        showSheet(scanHTML());
      }
    }, function (err) {
      if (sc) setBusy(false, err.message);
    });
  }

  /* ---------- Aktionen ---------- */
  var ACTIONS = {
    scan: function () { sc = { step: 1, bc: '', vals: {}, flag: null, busy: false }; showSheet(scanHTML()); },
    open: function (t) {
      var id = Number(t.dataset.id);
      var p = list.items.concat(S.favs, recent()).filter(function (x) { return x.id === id; })[0];
      if (p) openProduct(p);
    },
    close: function () { closeSheet(); },
    retry: function () { load(true); },
    more: function () { load(false); },
    filt: function (t) {
      filt = t.dataset.f;
      draw();
      var b = document.querySelector('[data-f="' + filt + '"]');
      if (b) b.focus();
    },
    qg: function (t) { cur.val = Number(t.dataset.v); var i = $('#pv'); if (i) i.value = cur.val; $('#pcalc').innerHTML = calcHTML(); },
    fav: function () {
      var id = cur.p.id;
      if (isFav(id)) S.favs = S.favs.filter(function (f) { return f.id !== id; });
      else S.favs.push(cur.p);
      C2F.save();
      showSheet(productHTML());
      draw();
    },
    addcur: function () {
      var g = grams();
      if (!(g > 0)) { C2F.toast('Bitte eine Menge größer als 0 eingeben.'); return; }
      var p = cur.p, k = C2F.nutP(p, g).k, m = cur.meal;
      S.ue.push({ id: 'u' + Date.now(), d: C2F.dayKey(0), m: m, g: Math.round(g * 10) / 10, snap: p });
      C2F.save();
      C2F.flashToast(p.name + ' zu ' + MEALS[m] + ' hinzugefügt (+' + fmt(k) + ' kcal).');
      location.href = 'heute.html';
    },
    scanbc: function () { lookup(C2F.SIM_BC[simIdx++ % C2F.SIM_BC.length]); },
    scanmanual: function () { lookup(($('#bcIn').value || '').replace(/\s+/g, '')); },
    scanback: function () { sc.step = 1; showSheet(scanHTML()); },
    scanocr: function () {
      var o = C2F.OCR[ocrIdx++ % C2F.OCR.length], s = function (x) { return String(x).replace('.', ','); };
      sc.vals = { name: '', brand: '', bc: sc.bc, k: s(o.k), f: s(o.f), c: s(o.c), p: s(o.p) };
      sc.flag = o.flag; sc.step = 3; showSheet(scanHTML());
    },
    rescan: function () { sc.step = 2; showSheet(scanHTML()); },
    savep: function () {
      var v = sc.vals, P = function (k) { return parseFloat(String(v[k]).replace(',', '.')); }, name = (v.name || '').trim();
      if (!name) return scMsg('Bitte einen Produktnamen eingeben.');
      var bc = (v.bc || '').replace(/\s+/g, '');
      if (!BARCODE.test(bc)) return scMsg('Der Barcode muss aus 8 bis 14 Ziffern bestehen.');
      var labels = { k: 'Energie', f: 'Fett', c: 'Kohlenhydrate', p: 'Eiweiß' };
      for (var k in labels) { if (!isFinite(P(k)) || P(k) < 0) return scMsg('Bitte einen gültigen Wert für ' + labels[k] + ' eingeben.'); }
      if (P('f') + P('c') + P('p') > 100) return scMsg('Fett, Kohlenhydrate und Eiweiß ergeben zusammen mehr als 100 g pro 100 g. Bitte Werte prüfen.');
      var body = { barcode: bc, name: name, kcal: P('k'), protein: P('p'), carbs: P('c'), fat: P('f') };
      var brand = (v.brand || '').trim();
      if (brand) body.brand = brand;
      setBusy(true, 'Wird gespeichert …');
      api.createProduct(body).then(function (created) {
        if (!sc) return;
        openProduct(C2F.mapProduct(created));
        C2F.toast('Neues Produkt für alle Nutzer gespeichert.');
        if (filt === 'all') load(true);
      }, function (err) {
        if (!sc) return;
        if (err.status === 409) {
          /* Jemand war schneller: das vorhandene Produkt öffnen statt ein Duplikat anzulegen */
          api.productByBarcode(bc).then(function (p) {
            if (!sc) return;
            if (p) { C2F.toast('Dieses Produkt gibt es schon in der Datenbank.'); openProduct(C2F.mapProduct(p)); }
            else setBusy(false, err.message);
          }, function () { if (sc) setBusy(false, err.message); });
          return;
        }
        setBusy(false, err.message);
      });
    }
  };

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    var f = ACTIONS[t.dataset.act];
    if (f) f(t, e);
  });
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !sheet.hidden) closeSheet();
    if (e.key === 'Enter' && e.target && e.target.id === 'bcIn') { e.preventDefault(); ACTIONS.scanmanual(); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'q') {
      q = t.value;
      if (filt === 'all') { clearTimeout(timer); timer = setTimeout(function () { load(true); }, 300); }
      else draw();
    }
    else if (t.id === 'pv') { cur.val = t.value; $('#pcalc').innerHTML = calcHTML(); }
    else if (t.id === 'pm') { cur.meal = Number(t.value); }
    else if (t.dataset.sf) { sc.vals[t.dataset.sf] = t.value; }
  });

  load(true);
  C2F.showFlash();
})();
