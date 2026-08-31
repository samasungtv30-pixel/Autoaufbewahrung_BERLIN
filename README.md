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
2. Versandart und Zugangsdaten des E-Mail-Anbieters eintragen (siehe unten).
3. Unter `INQUIRY_RECIPIENT` die Empfaengeradresse des Betriebs eintragen.

Neue Formularanfragen werden ausschliesslich per E-Mail an den Betrieb weitergeleitet.
Der Website-Server verarbeitet die Angaben voruebergehend im Arbeitsspeicher und legt
keine Anfrage-Dateien, Datenbankeintraege oder dauerhafte Versandwarteschlange an.
Anfrageinhalte und Provider-Fehlermeldungen werden nicht protokolliert. Der Spam-Schutz
haelt nur pseudonymisierte Zugriffsschluessel mit Zeitstempeln im Arbeitsspeicher vor;
inaktive Eintraege werden nach zehn Minuten beim naechsten minutenweisen Durchlauf entfernt.

Wenn der Interessent eine E-Mail-Adresse angibt, wird sie als Antwortadresse gesetzt.
Der Betrieb kann in seinem Mailprogramm direkt auf die Anfrage antworten. Es wird
keine automatische Kopie an den Interessenten verschickt.

Die Website bestaetigt den Versand erst nach Annahme durch den Versanddienst. Das ist
noch kein Nachweis fuer den Eingang im Posteingang (Spamfilter oder spaetere Bounces
sind moeglich). Bei fehlender Einrichtung, Ablehnung oder einem Versandfehler zeigt
das Formular eine Fehlermeldung und behaelt die Eingaben. Es gibt keine Speicherung
als Ausweichloesung und keine automatischen Wiederholungsversuche.

### Render Free: Versand ueber HTTPS

Render Free sperrt die ueblichen SMTP-Ports 25, 465 und 587. Dafuer ist ein optionaler
HTTPS-Transport fuer Resend vorbereitet, ohne zusaetzliche SDK-Abhaengigkeit:

- `MAIL_TRANSPORT=resend`
- `RESEND_API_KEY`: serverseitiger API-Schluessel des freigegebenen Versandkontos
- `MAIL_FROM_EMAIL`: Absender auf einer beim Versanddienst verifizierten Domain
- `MAIL_FROM_NAME`: gewuenschter Absendername
- `INQUIRY_RECIPIENT`: echte Empfaengeradresse des Betriebs

Der Transport wird erst mit gueltigen Zugangsdaten aktiv. Es wird kein Konto automatisch
angelegt. Die Anbieterwahl, Datenverarbeitung und Aufbewahrung beim Versanddienst und
im Empfaengerpostfach sind mit dem Betreiber zu klaeren. Keine Anfrage-Datenbank auf
dem Website-Server bedeutet nicht, dass E-Mail-Anbieter keine Daten verarbeiten oder speichern.
Hosting-Zugriffsprotokolle sind davon ebenfalls getrennt zu betrachten.

### Alternative: SMTP

Auf einem Hosting mit freigegebenem SMTP kann `MAIL_TRANSPORT=smtp` verwendet werden.
Zusaetzlich zu Absender und Empfaenger werden `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_USER` und `SMTP_PASS` benoetigt. Die bisherigen Variablen `SMTP_FROM_EMAIL` und
`SMTP_FROM_NAME` funktionieren als Ersatz fuer `MAIL_FROM_EMAIL` und `MAIL_FROM_NAME`.
Der Versand erfordert TLS. Platzhalteradressen werden nicht als Versandziel akzeptiert.

Referenzen: [Render Free](https://render.com/docs/free),
[Resend E-Mail-API](https://resend.com/docs/api-reference/emails/send-email).

### Abnahme

`npm run check` testet Versandannahme, Ablehnung, fehlende Konfiguration, fehlende
Dateischreibzugriffe, Spam-Schutz und Formularverhalten mit simulierten Versanddiensten.
Vor dem produktiven Einsatz muss eine echte, mit dem Betreiber abgestimmte Testanfrage
im Zielpostfach eintreffen; Absender, Antwortfunktion und Spam-Ordner pruefen.
Bestehende Anfrage-Dateien aus aelteren Installationen und eventuelle Sicherungen
werden nicht automatisch migriert oder geloescht und sind separat zu pruefen.

## Vor dem finalen Go-Live erforderlich

- Firmenname, Rechtsform, Inhaber und vollstaendige Anschrift
- Telefonnummer, WhatsApp-Nummer und Empfaenger-E-Mail
- bestaetigte Oeffnungszeiten und gepruefte Kartenposition der Betriebsadresse
- bestaetigte Leistungen, Paketbestandteile, Dauerangaben und Preise
- echte Werkstatt- und Projektbilder mit dokumentierten Bildrechten
- E-Mail-Versandzugang als Render Environment Variables und erfolgreich gepruefter Eingang im Zielpostfach
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

E-Mail-Zugangsdaten werden ausschliesslich als geschuetzte Environment Variables
im Render Dashboard eingetragen und niemals in GitHub gespeichert.
