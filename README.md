# Autoaufbereitung Website

Produktionsnahe Website-Basis fuer einen Autoaufbereitungsbetrieb. Inhalte, Leistungen und Preise bleiben bis zur Kundenfreigabe eindeutig als vorbereitete Struktur gekennzeichnet.

## Struktur

- `frontend/` enthaelt die oeffentlichen Seiten, CSS und Browser-JavaScript.
- `backend/server.js` liefert die Website, `robots.txt`, `sitemap.xml`, `/api/config` und eine einfache Angebotsanfrage unter `/api/inquiry`.
- `backend/data/site.json` ist die zentrale Inhaltsdatei fuer Kundendaten, Leistungsdetails, Preise, Oeffnungszeiten und FAQ.
- `scripts/check-site.js` prueft Seitenstruktur, interne Links, Assets und Leistungsdaten vor jedem Deployment.

## Oeffentliche Freigaben

- Pakete bleiben mit `packagesConfirmed: false` in `backend/data/site.json` intern vorbereitet. Die API liefert sie dann nicht aus; Paketbereich und Formular-Vorauswahl bleiben deaktiviert. Erst nach Freigabe echter Paketbestandteile und Preise auf den booleschen Wert `true` setzen.
- Die Galerie ist aus dem oeffentlichen Frontend entfernt. Eine spaetere Galerie benoetigt echte, freigegebene Kundenarbeiten.
- Karte und Route verwenden die vollstaendige Adresse aus der Konfiguration. Ohne Adresse bleiben sie deaktiviert; Google Maps wird erst nach einem ausdruecklichen Klick geladen.
- Fehlende Kontaktangaben werden nicht als funktionsfaehige Telefonnummern oder E-Mail-Adressen verlinkt.

## Start

```bash
npm run dev
```

Danach ist die Website unter `http://localhost:3100` erreichbar.

## E-Mail-Versand fuer Anfragen

1. `.env.example` als `.env` anlegen.
2. SMTP-Zugangsdaten des E-Mail-Anbieters eintragen.
3. Unter `INQUIRY_RECIPIENT` die Empfaengeradresse des Betriebs eintragen.

Neue Formularanfragen werden rate-limitiert, serverseitig gespeichert und per E-Mail versendet. Wenn der
Interessent eine E-Mail-Adresse angibt, wird sie als Antwortadresse gesetzt. Dadurch
kann der Betrieb in seinem Mailprogramm direkt auf die Anfrage antworten.

## Vor dem finalen Go-Live erforderlich

- Firmenname, Rechtsform, Inhaber und vollstaendige Anschrift
- Telefonnummer, WhatsApp-Nummer und Empfaenger-E-Mail
- bestaetigte Oeffnungszeiten und gepruefte Kartenposition der Betriebsadresse
- bestaetigte Leistungen, Paketbestandteile, Dauerangaben und Preise
- echte Werkstatt- und Projektbilder mit dokumentierten Bildrechten
- SMTP-Zugangsdaten als Render Environment Variables
- rechtliche Pruefung von Impressum und Datenschutz
- finale Domain in `publicUrl` und Render

Die vorhandenen Automotive-Motive sind als Leistungsvisualisierungen gekennzeichnet und duerfen nicht als Kundenreferenzen bezeichnet werden.

## Vom Restaurant-Projekt adaptiert

Die neue Version uebernimmt bewusst nur die sinnvollen technischen Muster:

- statisches Frontend mit Node-Backend
- zentrale Konfigurationsdaten
- SEO-Basis mit Sitemap und Robots-Datei
- schnelle Kontaktwege per Telefon, WhatsApp und Anfrageformular
- klare Trennung zwischen Inhalt, Struktur und Styling

Restaurant-spezifische Module wie Speisekarte, Warenkorb, Tischreservierung und mehrsprachige Restauranttexte wurden nicht uebernommen.

## Render Deployment

Das Repository enthaelt eine `render.yaml` fuer einen Node-Web-Service. Render
installiert die Abhaengigkeiten mit `npm ci --omit=dev`, startet die Anwendung
mit `npm start` und prueft den Status ueber `/health`. Neue Commits auf `main`
werden automatisch veroeffentlicht.

SMTP-Zugangsdaten werden ausschliesslich als geschuetzte Environment Variables
im Render Dashboard eingetragen und niemals in GitHub gespeichert.
