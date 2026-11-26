# Commit2Fit – Frontend

Web-App (mobile-first, läuft im Browser) für den Kalorien-Tracker, Software Engineering Project, FH Technikum Wien.
Reines HTML, CSS und JavaScript, kein Build-Schritt. Das Frontend spricht per REST/JSON mit dem Backend im Ordner `../backend`.

## Starten

1. Backend starten (Details in `../backend/README.md`):
   ```bash
   cd backend
   npm install
   npm run db:up
   npm run migrate
   npm run seed
   npm start
   ```
   Das Backend läuft dann auf `http://localhost:3000`.
2. Frontend öffnen:
   - VS Code mit der Erweiterung "Live Server": Rechtsklick auf `frontend/index.html` -> Open with Live Server, oder
   - `index.html` per Doppelklick im Browser öffnen.
3. Anmelden. Nach `npm run seed` gibt es das Konto `demo@commit2fit.test` mit dem Passwort `Demo1234!`. Eigene Konten legst du mit "Registrieren" an.

Die Adresse des Backends steht in `js/config.js`. Standard ist derselbe Rechner wie die Seite auf Port 3000. Für ein anderes Ziel, zum Beispiel ein Handy im selben WLAN, setzt du in der Browser-Konsole:
```js
localStorage.setItem('c2f-api', 'http://192.168.0.10:3000')
```

## Seiten

| Seite | Inhalt | Anforderung |
| --- | --- | --- |
| `login.html` | Anmelden und Registrieren | F11 |
| `heute.html` | Tagesbilanz, Makros, Mahlzeiten, Warnungen | F04, F06, F08 |
| `produkte.html` | Produktsuche, Produktdetails, Scan-Ablauf, neues Produkt | F01, F02, F03 |
| `verlauf.html` | Wochendiagramm, Tagesansicht, Durchschnitt | F05 |
| `fasten.html` | Fasten-Timer (16:8, 18:6, 20:4, Ramadan) | F07 |
| `profil.html` | Konto, Körperdaten, Tagesziel, Verbindung zum Backend | F06 |

`index.html` leitet auf `heute.html` weiter. Wer nicht angemeldet ist, landet automatisch auf `login.html`.

## Was kommt vom Backend, was ist lokal

| Funktion | Quelle | Endpunkt |
| --- | --- | --- |
| Registrieren, Anmelden | Backend | `POST /auth/register`, `POST /auth/login` |
| Produktsuche (Name, Marke), Seiten à 20 | Backend | `GET /products?search=&limit=&offset=` |
| Produkt per Barcode | Backend | `GET /products/:barcode` |
| Neues Produkt speichern, Duplikat -> 409 | Backend | `POST /products` |
| Eintrag zum Tagebuch hinzufügen, löschen | Backend | `POST /intake`, `DELETE /intake/:id` (T094, T095) |
| Tag auf "Heute" und in der Tagesansicht | Backend | `GET /diary?date=` (T094) |
| Wochendiagramm, Durchschnitt, Warnungen im Verlauf | Backend | `GET /diary/totals?from=&to=` (T096) |
| Profil (Körperdaten) | Backend, sobald vorhanden, sonst lokal | `GET/PUT /profile` (T097), das Backend hat den Endpunkt noch nicht und antwortet 404 |
| Tagesziel, Warnungen berechnen | lokal (Browser) | rechnet aus dem Profil, siehe `js/state.js` |
| Fasten-Timer, Favoriten, zuletzt benutzte Produkte | lokal (Browser) | optional |

Das Tagebuch liegt auf dem Server und ist auf jedem Gerät mit demselben Konto gleich (F11). Während Daten geladen werden, zeigt die Seite "Wird geladen …". Ist der Server nicht erreichbar, erscheint eine Fehlermeldung mit "Erneut versuchen".

Das Profil wird lokal gespeichert und nach kurzer Pause (0,8 s) per `PUT /profile` an den Server geschickt. Antwortet das Backend mit 404, bleibt es lokal, und die Profilseite sagt das. Die Feldnamen für `/profile` stehen in `api.js` (`profileToApi`, `profileFromApi`) und sind eine Annahme, die mit dem Backend abzustimmen ist.

Lokale Daten (Profil, Favoriten, Fasten-Timer) liegen pro Konto im `localStorage` und sind auf einem zweiten Gerät nicht sichtbar.

## Aufbau

```
frontend/
├── index.html, login.html, heute.html, produkte.html, verlauf.html, fasten.html, profil.html
├── css/style.css       Design-Tokens (hell/dunkel) und Komponenten
└── js/
    ├── util.js         Helfer (Datum, Zahlenformat, Icons)
    ├── config.js       Adresse des Backends
    ├── api.js          alle REST-Aufrufe (C2F.api.*), Token, deutsche Fehlertexte, Zugangsschutz
    ├── data.js         feste Werte und die Demo-Daten für den simulierten Scan
    ├── state.js        lokaler Zustand, Tagebuch vom Server laden (loadDiary, loadTotals), Tagesziel (Mifflin-St Jeor), Warnlogik
    ├── ui.js           gemeinsame Bausteine (Toast, Warnboxen, Lade- und Fehleranzeige, Makro-Balken, Mahlzeitenliste)
    └── login.js, heute.js, produkte.js, verlauf.js, fasten.js, profil.js   je ein Skript pro Seite
```
Die Skripte teilen sich den Namensraum `window.C2F` und werden in dieser Reihenfolge geladen:
util, config, api, data, state, ui, dann das Seitenskript. Nur `api.js` kennt URLs. Wenn das Backend neue Endpunkte bekommt,
kommt die Funktion dazu in `api.js`, und `state.js` ruft sie statt `localStorage` auf.

## Bekannte Grenzen

- **Scan:** Die Kamera ist nicht angebunden. "Barcode scannen" liefert Demo-Barcodes (`SIM_BC` in `js/data.js`), die Abfrage im Backend ist echt. Barcodes lassen sich auch eintippen. Die Nährwerte beim Scan sind Demo-Werte (`OCR`).
- **Nährwerte:** Das Backend speichert nur kcal, Eiweiß, Kohlenhydrate und Fett pro 100 g. Zucker, Salz und Portionsgrößen gibt es dort nicht, deshalb zeigt das Frontend nur Mengen in Gramm.
- **Barcode:** Der Barcode ist optional (T078). Wenn er angegeben wird, muss er aus 8 bis 14 Ziffern bestehen.
- **Tagebuch von früher:** Einträge, die ältere Versionen des Frontends nur im Browser gespeichert haben, werden nicht mehr angezeigt und nicht auf den Server übertragen.
- **Profil:** Die Felder von `/profile` sind noch nicht festgelegt (siehe oben).
- **Schwellen:** Die Warnschwellen (zu hoch ab 115 %, zu niedrig unter 70 %) und die Makro-Verteilung sind ein Vorschlag und noch nicht mit dem PO abgestimmt.
- **Tests:** Die Skripte `util`, `config`, `api`, `data`, `state`, `ui` und `fasting` sind mit Unit-Tests abgedeckt (`npm test`, `npm run test:coverage` im Ordner `frontend`, 100 % Zeilen, Zweige und Funktionen). Die Seitenskripte (`heute.js`, `verlauf.js`, `produkte.js`, `profil.js` ...) sind nicht in den Unit-Tests enthalten und wurden im Browser geprüft, auch mit zwei Browsern am selben Konto (T098) und bei 360, 390 und 412 px Breite (T099).
