# Production Readiness: 31.08.2026

## Ergebnis

Technischer Hardening-Pass abgeschlossen; **noch keine Freigabe für echte Kundenanfragen**.
Design, Navigation, Leistungen und Texte wurden nicht neu konzipiert. Unternehmensdaten
bleiben bewusst Platzhalter. Es wurden keine echten E-Mails versendet und keine
Versandzugänge aktiviert. Der Prüfstand ist eine öffentlich erreichbare, nicht indexierbare Vorschau.

## A. Behobene technische Probleme

- Leistungen, Leistungstexte, FAQ, Öffnungszeiten, Kontaktangaben und freigegebene Pakete
  stehen bereits im ausgelieferten HTML. JavaScript ist dafür nicht mehr erforderlich.
- `backend/render.js` verarbeitet die bestehenden Vorlagen mit Cheerio. Dieser Parser
  ist eine serverseitige Abhängigkeit, keine neue Browser- oder Animationsbibliothek.
- `frontend/js/business.js` vereinheitlicht Kontaktprüfung, URL-Encoding und Kartenposition
  zwischen Server und Browser. Die bisherige zusätzliche Konfigurationsabfrage entfällt.
- Rechtsform, Inhaber, Register, USt-ID, verantwortliche Person, Land, optionale Koordinaten
  und Social-Links sind zentral vorbereitet. Keine Fantasiedaten eingesetzt.
- Nur freigegebene Pakete werden gerendert. Inaktive Leistungsseiten liefern 404 und
  werden aus Leistungslisten und Sitemap ausgeschlossen.
- Maps: kein automatisches Laden, Ladezustand, Timeout, Fehlermeldung und Wiederholungsversuch.
- Defekte Bilder erhalten einmalig ein lokales Ersatzmotiv, ohne Endlosschleife.
- Alte clientseitige Renderer, Timeline-Logik, ungenutzte Review-Daten, 17 obsolete CSS-Regeln
  und das unreferenzierte Motiv `paint-before-after.webp` entfernt. Aktuell verwendete
  Innenraum-/Felgenbilder und die vorbereitete Paketkomponente bleiben erhalten.
- Der Go-live-Check prüft zentrale Werte statt dauerhaft in HTML-Vorlagen stehender Platzhalter.

## B. Performance und Accessibility

- Gzip für öffentliche Textantworten, begrenzter Kompressionscache und ETag/304 für Assets.
  Anfragen und `no-store`-Antworten landen nicht in diesem Cache.
- Lokale Messung der Leistungsseite: 37.388 Byte HTML unkomprimiert, 4.878 Byte übertragen
  mit Gzip, etwa 87 % weniger. Das ist ein Payload-Vergleich derselben Seite, kein CWV-Score.
- `main.js`: 30.153 auf 16.548 Byte reduziert; Gzip 8.297 auf 5.178 Byte. Dazu kommt die
  kleine gemeinsame Business-Hilfsdatei. CSS: rund 17,7 KB + 6,8 KB Gzip.
- Hero-/Detailbilder sind im ersten HTML mit Dimensionen und hoher Ladepriorität vorhanden;
  unterhalb liegende Motive bleiben lazy. Bestehende WebP-Dateien, lokale WOFF2-Fonts,
  `font-display: swap` und die beiden gezielten Font-Preloads bleiben erhalten.
- Korrekte H2-Hierarchie für Leistungskarten, sichtbare Fokuszustände, Labels und
  Statusmeldungen geprüft. Honeypot bleibt aus Tab-Reihenfolge und Accessibility-Tree
  ausgeschlossen und verursacht keinen negativen horizontalen Überlauf.
- Navigation ohne JavaScript über separate `noscript`-Styles vorbereitet. Das Formular
  benötigt weiterhin JavaScript und zeigt ohne JavaScript den vorhandenen Hinweis.
- Ein hässlicher Wortumbruch bei 320 Pixeln auf der Leistungsseite wurde mit einer eng
  begrenzten Schriftgrößenkorrektur behoben. Kein allgemeines Redesign.
- Rechnerische Kontrast-Stichproben auf der hellsten Grundfläche `#252d30`:
  Fließtext `#c8d1d2` 9,02:1, heller Text `#f5f8f7` 13,13:1;
  dunkler Primärbutton-Text auf Lime 15,74:1. Kein vollständiges WCAG-Zertifikat.
- Reduced-Motion- und Forced-Colors-Regeln geprüft und beibehalten.

## C. Security

- Neue HTML-Ausgabe escaped konfigurierbare Texte und Attribute. Eingebettetes JSON ist
  gegen vorzeitiges Schließen des Script-Elements abgesichert. Lokale Bilder und Icons
  werden über eingeschränkte Pfade eingebunden.
- `/api/config` und eingebettete Daten geben nur ausdrücklich erlaubte öffentliche Felder
  aus. Interne Zusatzfelder werden nicht automatisch mit veröffentlicht.
- Regressionstests für Origin-/Content-Type-Prüfung, Payload-Limit, fehlerhafte URLs,
  Path Traversal, Rate-Limit, Security Headers, feste Canonicals und fehlende Privatdateien.
- Vorhandene CSP, TLS-Mailtransport, sichere Empfängerfestlegung, HTML-Escaping für Mails
  und kurzlebige pseudonymisierte Missbrauchszähler beibehalten.
- Kein Speichern von Anfrageinhalten, kein Local-/Session-Storage, keine neuen Tracker.
  Provider-Fehler mit potenziellen personenbezogenen Daten werden nicht protokolliert.
- `.env` ist ignoriert; keine getrackten `.env`-/Schlüsseldateien und keine Treffer in der
  Musterprüfung gängiger Schlüsseltypen in den geprüften Quellen. Dies ersetzt keinen
  umfassenden Secret-Scan der gesamten Git-Historie oder einen externen Penetrationstest.
- `npm audit --omit=dev`: 0 gemeldete Schwachstellen zum Prüfzeitpunkt. Ein transitive
  Deprecation-Hinweis auf `whatwg-encoding` ist kein nachgewiesener Sicherheitsbefund;
  Updates des Parser-Pakets weiter beobachten.

## D. Durchgeführte Tests

- `npm run check`: **30/30 Node-Tests bestanden**, zusätzlich Struktur-/Link-/Asset-/Text-
  Prüfungen für 14 HTML-Seiten und 7 Leistungen sowie UI-Fixtures.
- `npm run format:check` und `git diff --check`: bestanden.
- HTTP-Integration: 200/308/404/405, HEAD, Gzip, Gzip-Ablehnung, ETag/304,
  Security Headers, Vorschau-Noindex und API-Schutz.
- Formulartests mit simuliertem bzw. deaktiviertem Mailtransport: Annahme, Ablehnung,
  Netzwerkfehler, fehlende Einrichtung, UTF-8-Chunkgrenzen, Honeypot, Pflichtfelder,
  Telefonformat, Doppelabsendung, Loading, Reset nur bei bestätigter Annahme.
- Maps-Fixtures: fehlende Adresse, valide Testadresse/Koordinaten, Consent, Laden,
  Load-Event, Timeout, Error-Event und erneuter Versuch. Keine echte Google-Karte geladen.
- SSR-Tests: Inhalte ohne Client-Rendering, Paketfreigabe, zentrale Datenübernahme,
  Injection-Versuche, Metadaten, einzigartige IDs, eine H1 und bedingtes JSON-LD.
- Browser: Startseite, Leistungen, Pakete und Kontakt in **320, 360, 375, 390, 430, 768,
  1024, 1280, 1440, 1920, 2560 px**. Zusätzlich alle sieben Leistungsdetailseiten,
  Impressum, Datenschutz und 404 jeweils in 320 und 1440 px: insgesamt 64 Layout-Stichproben.
  Keine erkannten horizontalen Überläufe; geladene Bilder ohne erkannte Defekte.
- Screenshots: mobile Startseite, Leistungen, Menü, Standort und Formular sowie
  Desktop-Kontakt. Standort steht weiterhin vor dem Formular.
- Interaktiv im Browser: Menü öffnen/schließen, Escape mit Fokus-Rückgabe, CTA-Anker,
  FAQ per Klick, leere Pflichtfelder und Fehlversand auf lokalem Server.
- Fokusfalle per Unit-Test geprüft. Native Tab-/Enter-Standardaktionen ließen sich in der
  verfügbaren Browsersteuerung nicht zuverlässig verifizieren; dies ist keine bestandene
  vollständige Tastaturabnahme. SSR-/No-JS-Verhalten ist über HTML-/CSS-Prüfung abgesichert,
  nicht durch einen echten Browserlauf mit ausgeschaltetem JavaScript.

## E. Offen vor Go-live

1. Unternehmensdaten liefern und zentral eintragen; Leistungsumfang, Dauerangaben,
   Bildrechte und vorhandene Aussagen vom Betreiber bestätigen lassen.
2. Betreiber muss Impressum/Datenschutz gegen tatsächliches Hosting, Mailanbieter,
   Maps-Einbettung und Kontaktwege prüfen lassen und `legal.reviewed` danach auf `true` setzen.
3. Mailanbieter/Absenderdomain/Empfänger bestätigen, Zugangsdaten ausschließlich als
   Environment Variables setzen. Echte Testmail inklusive Reply-To und Spam-Ordner abnehmen.
4. Echte Adresse bzw. Kartenposition eintragen; Karte nach Consent und Route auf echten
   Geräten prüfen. Telefonnummer, WhatsApp-Fotoversand und E-Mail-App ebenfalls testen.
5. Safari/iOS, Firefox und Edge sowie reale Chrome-/Android-Geräte abnehmen. Hier wurde
   nur der verfügbare integrierte Chromium-Browser verwendet, keine Cross-Browser-Freigabe.
6. LCP/CLS/INP auf dem finalen Hosting mit echten Inhalten messen. Keine verifizierten
   Core-Web-Vitals-Feldwerte oder Lighthouse-Scores aus dieser Runde. Die Browsersteuerung
   stellt die benötigten Performance-Timeline-Daten hier nicht bereit. Langsame reale
   Mobilverbindungen und virtuelle Tastaturen gehören in die Geräteabnahme.
7. Finale Domain, HTTPS und Proxy-Kette aus zwei Netzen prüfen. Danach `check:launch`,
   Betreiberabnahme und erst anschließend `indexingEnabled: true`.

`npm run check:launch` schlägt derzeit **erwartungsgemäß fehl**: Platzhalter, fehlende
Rechtstextfreigabe, nicht eingerichteter Versand und gesperrte Indexierung.

## F. Zentrale Kundendaten

Datei: `backend/data/site.json`.

| Bereich | Felder / Entscheidung |
| --- | --- |
| Marke | `siteName`, `shortName`, `logo`, `logoAlt`, finale `publicUrl` |
| Kontakt | `phone`, `whatsapp` als `https://wa.me/` plus internationale Ziffern, `email` |
| Standort | `address.street`, `zip`, `city`, `country`; `latitude`/`longitude` optional als Zahlen |
| Öffnungszeiten | `openingHours[].day` und `.hours`; optional strukturierte `schemaDays`, `opens`, `closes` |
| Rechtliches | `legal.owner`, `legalForm`, `register`, `vatId`, `contentResponsible`, `reviewed` |
| Social | `socialLinks` mit freigegebenen HTTPS-Profilen; ohne Profile leeres Array |
| Leistungen | tatsächliche Leistungen/Schritte bestätigen; `active` je Leistung |
| Pakete | `packagesConfirmed` erst bei echten bestätigten Angeboten auf `true` setzen |
| Suche | `indexingEnabled` bleibt bis zur endgültigen Freigabe `false` |

Register/USt-ID dürfen nach Prüfung leer bleiben, wenn sie nicht zutreffen. Das sichtbare
Logo ist eine austauschbare Datei, sein Schriftzug wird nicht aus dem Firmennamen generiert.
Mailzugänge und `INQUIRY_RECIPIENT` gehören **nicht** in `site.json`, sondern in die
geschützte Hosting-Konfiguration. Aktuelle Test-Empfänger nicht ungeprüft übernehmen.

## G. Bewusst unverändert / Grenzen

- Keine neuen Leistungen, Preise, Bewertungen, Galerie, Tracking oder Animation-Libraries.
- Die Rechtstexte wurden nicht juristisch neu geschrieben. Besonders die bestehende
  Aussage zum Verlassen der Website bei Google Maps muss bei der finalen Prüfung zur
  tatsächlichen Einbettung passen. Eine zentrale Datenfreigabe ersetzt diese Prüfung nicht.
- Ein Cross-Origin-Iframe kann ein `load`-Event auch für eine nicht nutzbare Google-Seite
  auslösen. Der Browser darf deren Inhalt nicht kontrollieren. Timeout/Retry und externer
  Routenlink helfen, garantieren aber nicht die Verfügbarkeit von Google.
- Das prozesslokale Rate-Limit ist kein verteilter DDoS-Schutz. Ein Neustart setzt es zurück;
  gemeinsame Netze können sich das Limit teilen. Keine unnötige Infrastruktur ergänzt.
- Keine dauerhafte Queue und keine automatische Wiederholung von Mails. Bei Timeout
  kann der Provider eine Nachricht dennoch angenommen haben; manuelles erneutes Absenden
  kann eine zweite Nachricht erzeugen. Das wird nicht durch heimliche Datenspeicherung gelöst.
- Render-Tarif und mögliche Kaltstarts wurden nicht kostenpflichtig verändert. Hosting- und
  Mailanbieterprotokolle sind getrennt von der fehlenden Anfrage-Datenbank zu betrachten.
- Nur sichere, nachweislich tote CSS-Bereiche entfernt; kein riskantes Komplett-Rewrite
  des bestehenden Stylesheets. Die visuelle Richtung bleibt unverändert.

Technische Referenzen: [Cheerio](https://cheerio.js.org/docs/intro/),
[Schema.org Automotive](https://schema.org/docs/automotive.html).
