# Betrieb Maschinen App v4 - Lieferschein

Neu:
- Kundenfelder in der App
- Lieferschein-Vorschau
- Lieferschein als PDF über Browser-Druckfunktion
- automatische Lieferscheinnummer LS-JAHR-0001
- Dienstleister-Beispiel: Max Mustermann
- kein "by Steininger Flo" auf dem Lieferschein
- "by Steininger Flo" bleibt nur in der App
- feste Spalten in Google Sheets bleiben erhalten
- Auswertung pro Maschine, Fahrer und Kunde

Wichtig:
1. Dateien auf GitHub hochladen
2. In Google Apps Script den Code aus `google-apps-script/Code.gs` komplett ersetzen
3. Speichern
4. Bereitstellen -> Bereitstellungen verwalten -> Stift -> Neue Version -> Bereitstellen
5. Vercel redeployen

Hinweis PDF:
Die App öffnet eine Druckansicht. Dort am Handy/PC "Als PDF speichern" wählen.

Dienstleisterdaten stehen in `src/App.jsx` im Block `DIENSTLEISTER`.

© by Steininger Flo
