# Commit2Fit – Frontend-Prototyp

Klickbarer Prototyp der Commit2Fit-App (Kalorien-Tracker, Software Engineering Project, FH Technikum Wien).

## Starten
- `index.html` im Browser öffnen, oder
- in VS Code mit der Erweiterung "Live Server" (Rechtsklick auf `index.html` -> Open with Live Server).

## Struktur
- `index.html` – Seitengerüst: Tab-Leiste, Container für Ansichten und Bottom-Sheets
- `css/style.css` – Design-Tokens (hell/dunkel) und alle Komponenten
- `js/app.js` – Zustand, Berechnungen und Ansichten (Heute, Produkte, Verlauf, Fasten, Profil)

## Umgesetzte Anforderungen
F01 Produkt auswählen · F02 Scan (simuliert) · F03 Speichern ohne Duplikate (Barcode) · F04 Aufnahme berechnen ·
F05 Verlauf · F06 Warnungen · F07 Fasten-Timer. NF01/NF02: mobile-first, responsiv.

## Hinweise
- Die Kamera ist nicht angebunden, der Scan läuft mit Beispieldaten (`SIM_BC`, `OCR` in `js/app.js`).
- Daten liegen nur im Browser (localStorage), es gibt kein Backend. Die Beispieldaten sind erfunden.
- Nächster Schritt: Datenzugriff durch REST-Aufrufe ersetzen (C02), sobald das Backend steht.
