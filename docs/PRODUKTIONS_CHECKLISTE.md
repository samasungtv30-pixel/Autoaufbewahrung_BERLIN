# Produktions-Checkliste

Diese Liste trennt technische Fertigstellung von den noch ausstehenden Kundendaten.

## Technisch umgesetzt

- Responsive Website mit Startseite, Leistungen, Preisorientierung/Paketen, Kontakt und Rechtstexten; keine öffentliche Galerie
- Zentrale Konfiguration in `backend/data/site.json`
- Angebotsformular mit Spam-Falle, Rate-Limit, Datenschutzbestätigung und serverseitiger Validierung
- Direkter E-Mail-Versand ohne Anfrage-Datei, Datenbank oder dauerhafte Versandwarteschlange
- Erfolg erst nach Annahme durch den Versanddienst; bei Fehler bleiben die Formulareingaben erhalten
- Wahlweise HTTPS-Versand mit Resend oder TLS-gesicherter SMTP-Versand
- Antwortadresse des Interessenten als `Reply-To`, sofern eine E-Mail angegeben wurde
- Direkte Kontaktwege für Telefon, WhatsApp, E-Mail und Route
- Deaktivierte Kontaktaktionen, solange nur Platzhalterdaten vorhanden sind
- Google Maps erst nach aktiver Zustimmung und nur bei vollständiger Adresse oder validen Koordinaten; Ladefehler mit Wiederholungsversuch
- Leistungen, FAQ und Betriebsangaben bereits im serverseitigen HTML; sichere öffentliche Konfigurationsprojektion
- SEO-Grundlagen, Sitemap, Robots, Social-Metadaten und strukturierte Unternehmensdaten bei vollständiger Konfiguration
- Automatische Struktur-, Link-, Icon-, Text- und Konfigurationsprüfungen mit `npm run check`
- HTTP-Sicherheitstests, feste Node-24-LTS-Linie und Prüfungen bei GitHub/Render
- Suchmaschinenindexierung in der Vorschau gesperrt (`indexingEnabled: false`)

## Vor Veröffentlichung mit echten Kundendaten

- Firmenname, Logo, Inhaber, Rechtsform und vollständige Anschrift eintragen
- Telefonnummer, WhatsApp-Nummer und geschäftliche E-Mail-Adresse bestätigen
- Öffnungszeiten und Ablauf für Fahrzeugannahme und Übergabe bestätigen
- Tatsächlich angebotene Leistungen, Arbeitsschritte, Preise und Dauerangaben freigeben
- Echte Werkstatt- und Ergebnisbilder inklusive Nutzungsrechten bereitstellen
- Adresse oder numerische Koordinaten unter `address` eintragen und Kartenposition prüfen
- Impressum und Datenschutz fachlich prüfen lassen; anschließend `legal.reviewed: true` setzen
- Finale Domain in `publicUrl`, Sitemap, Canonical URLs und Render hinterlegen
- `npm run check:launch` ausführen und verbleibende Freigaben dokumentieren
- `indexingEnabled` erst nach vollständiger Betreiberfreigabe auf `true` setzen
- Proxy-Kette und Rate-Limit von zwei unterschiedlichen Netzwerken prüfen

## Render und E-Mail

Render Free sperrt SMTP-Ports 25, 465 und 587. Für diesen Tarif den vorbereiteten
HTTPS-Transport nach Freigabe des Versanddienstes einrichten. Folgende Werte
ausschließlich als Render Environment Variables setzen:

- `MAIL_TRANSPORT=resend`
- `RESEND_API_KEY`
- `MAIL_FROM_EMAIL` (verifizierte Absenderdomain)
- `MAIL_FROM_NAME`
- `INQUIRY_RECIPIENT`

Alternativ auf einem Hosting mit erlaubtem SMTP `MAIL_TRANSPORT=smtp` und zusätzlich:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_NAME`
- `SMTP_FROM_EMAIL`
- `INQUIRY_RECIPIENT`

Nach der Einrichtung eine echte Testanfrage senden und Eingang, Absender, `Reply-To` sowie Spam-Ordner prüfen.
Die Annahme durch den Versanddienst allein bestätigt noch nicht den Eingang im Zielpostfach.
Versanddienst, Postfach-Aufbewahrung und Hosting-Protokolle mit dem Betreiber klären.
Anfrage-Dateien und Backups aus älteren Installationen separat auf vorhandene Daten prüfen.

## Abnahme

Aktueller technischer Prüfstand vom 31.08.2026: siehe `PRODUCTION-READINESS-2026-08-31.md`.
Eine technisch bestandene Prüfung ersetzt keine fachliche oder rechtliche Freigabe.

- Smartphone-Test mit 320, 360, 375, 390 und 430 Pixel Breite
- Tablet- und Desktop-Test
- Telefon-, WhatsApp-, E-Mail- und Routenlinks auf echten Geräten prüfen
- Formular-Erfolg und Formular-Fehler testen
- Google-Maps-Zustimmung und Kartenanzeige prüfen
- Alle Platzhalter suchen und vor dem finalen Go-Live ersetzen
