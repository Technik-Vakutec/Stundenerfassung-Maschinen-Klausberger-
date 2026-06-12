# Betrieb Maschinen App v11 - Traktor Ja/Nein

Neu in v11:
- Beim Anbaugerät gibt es die klare Option: Traktor extra Ja/Nein
- Abrechnung: Stunden / Hektar / m³
- Wenn Traktor extra = Nein, wird die Zugmaschine nicht berechnet.
- Wenn Traktor extra = Ja, wird die Zugmaschine zusätzlich nach Stunden berechnet.
- Lieferschein und Google Sheets trennen Traktorkosten und Anbaugerätkosten.

Update:
1. Dateien auf GitHub ersetzen
2. Google Apps Script Code.gs komplett ersetzen
3. Speichern
4. Bereitstellen -> Bereitstellungen verwalten -> Stift -> Neue Version -> Bereitstellen
5. Vercel Redeploy

Environment Variable bleibt: VITE_GOOGLE_SCRIPT_URL

© by Steininger Flo


Änderungen v11:
- Einsatzart heißt jetzt Dienstleistung oder Verleih.
- Bei Verleih muss keine Zugmaschine ausgewählt werden.
- Bei Verleih werden keine Betriebsstunden benötigt.
- Anbaugeräte haben zusätzlich einen Verleihpreis pro Tag.
- Verleihkosten werden aus Zeitraum inkl. Start- und Enddatum berechnet.
