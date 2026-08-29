# Autoaufbereitung Website

Erste professionelle Website-Version fuer ein Autoaufbereitungs-Projekt.

## Struktur

- `frontend/` enthaelt die oeffentlichen Seiten, CSS und Browser-JavaScript.
- `backend/server.js` liefert die Website, `robots.txt`, `sitemap.xml`, `/api/config` und eine einfache Angebotsanfrage unter `/api/inquiry`.
- `backend/data/site.json` ist die zentrale Inhaltsdatei fuer Kundendaten, Leistungen, Preise, Oeffnungszeiten, Bewertungen und FAQ.

## Start

```bash
npm run dev
```

Danach ist die Website unter `http://localhost:3100` erreichbar.

## E-Mail-Versand fuer Anfragen

1. `.env.example` als `.env` anlegen.
2. SMTP-Zugangsdaten des E-Mail-Anbieters eintragen.
3. Unter `INQUIRY_RECIPIENT` die Empfaengeradresse des Betriebs eintragen.

Neue Formularanfragen werden lokal gespeichert und per E-Mail versendet. Wenn der
Interessent eine E-Mail-Adresse angibt, wird sie als Antwortadresse gesetzt. Dadurch
kann der Betrieb in seinem Mailprogramm direkt auf die Anfrage antworten.

## Spaeter ersetzen

Die Platzhalter in `backend/data/site.json` koennen mit echten Kundendaten ersetzt werden. Echte Bilder koennen in `frontend/images/` abgelegt und anschliessend in HTML/CSS oder in einer spaeteren Galerie-Datenstruktur referenziert werden.

## Vom Restaurant-Projekt adaptiert

Die neue Version uebernimmt bewusst nur die sinnvollen technischen Muster:

- statisches Frontend mit Node-Backend
- zentrale Konfigurationsdaten
- SEO-Basis mit Sitemap und Robots-Datei
- schnelle Kontaktwege per Telefon, WhatsApp und Anfrageformular
- klare Trennung zwischen Inhalt, Struktur und Styling

Restaurant-spezifische Module wie Speisekarte, Warenkorb, Tischreservierung und mehrsprachige Restauranttexte wurden nicht uebernommen.
