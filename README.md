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


Änderungen v12:
- Anbaugerät hinzufügen ist jetzt auf zwei Zeilen aufgeteilt.
- Name des Anbaugeräts hat eine eigene volle Zeile.
- Einheit, Preise, Traktor extra und Hinzufügen stehen darunter sauber formatiert.


Änderungen v13:
- Fehler beim Laden der Geräte behoben.
- Google Sheet Geräte wird mit alter und neuer Spaltenstruktur unterstützt.
- MietpreisTag wird korrekt gelesen.


Änderungen v14:
- Zugmaschinen und Anbaugeräte können geändert werden.
- Anbaugerät ist in Dienstleistung und Vermietung getrennt.
- Vermietung: Stunden, Hektar, m³ oder Tagesmiete.


Änderungen v15:
- package.json repariert.
- Vercel Build-Fehler wegen ungültigem JSON behoben.
