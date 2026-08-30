# Produktions-Checkliste

Diese Liste trennt technische Fertigstellung von den noch ausstehenden Kundendaten.

## Technisch umgesetzt

- Responsive Website mit Startseite, Leistungen, Preisen, Galerie, Kontakt und Rechtstexten
- Zentrale Konfiguration in `backend/data/site.json`
- Angebotsformular mit Spam-Falle, Rate-Limit, Datenschutzbestätigung und serverseitiger Validierung
- Speicherung der letzten 200 Anfragen und optionaler SMTP-E-Mail-Versand
- Antwortadresse des Interessenten als `Reply-To`, sofern eine E-Mail angegeben wurde
- Direkte Kontaktwege für Telefon, WhatsApp, E-Mail und Route
- Deaktivierte Kontaktaktionen, solange nur Platzhalterdaten vorhanden sind
- Google Maps erst nach aktiver Zustimmung und nur bei vollständiger Adresse
- SEO-Grundlagen, Sitemap, Robots, Social-Metadaten und strukturierte Unternehmensdaten bei vollständiger Konfiguration
- Automatische Struktur-, Link-, Icon-, Text- und Konfigurationsprüfungen mit `npm run check`

## Vor Veröffentlichung mit echten Kundendaten

- Firmenname, Logo, Inhaber, Rechtsform und vollständige Anschrift eintragen
- Telefonnummer, WhatsApp-Nummer und geschäftliche E-Mail-Adresse bestätigen
- Öffnungszeiten und Ablauf für Fahrzeugannahme und Übergabe bestätigen
- Tatsächlich angebotene Leistungen, Arbeitsschritte, Preise und Dauerangaben freigeben
- Echte Werkstatt- und Ergebnisbilder inklusive Nutzungsrechten bereitstellen
- Google-Maps-Link mit dem echten Unternehmensprofil eintragen
- Impressum und Datenschutz durch den Betreiber beziehungsweise fachlich prüfen lassen
- Finale Domain in `publicUrl`, Sitemap, Canonical URLs und Render hinterlegen

## Render und E-Mail

Folgende Werte ausschließlich als Render Environment Variables setzen:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_NAME`
- `SMTP_FROM_EMAIL`
- `INQUIRY_RECIPIENT`

Nach der Einrichtung eine echte Testanfrage senden und Eingang, Absender, `Reply-To` sowie Spam-Ordner prüfen.

## Abnahme

- Smartphone-Test mit 320, 360, 375, 390 und 430 Pixel Breite
- Tablet- und Desktop-Test
- Telefon-, WhatsApp-, E-Mail- und Routenlinks auf echten Geräten prüfen
- Formular-Erfolg und Formular-Fehler testen
- Google-Maps-Zustimmung und Kartenanzeige prüfen
- Alle Platzhalter suchen und vor dem finalen Go-Live ersetzen
