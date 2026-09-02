# Header-, Performance- und Codepruefung

Stand: 2026-09-02. Gezielte Korrektur, kein Redesign und keine Aenderung an Angeboten oder Mailversand.

## Gefundene und behobene Fehler

- Desktop: `body { overflow-x: hidden }` erzeugte einen unerwuenschten Scroll-Container. Der als sticky definierte Header verschwand beim Scrollen (gemessen: y = -400 px nach 400 px Scrollweg). `overflow-x: clip` stellt den korrekten Bezug zum Viewport her.
- Schriftladen: Die automatisch bemessene Kontaktspalte wanderte bei verzoegerten Fonts auf 1440 px von x = 1008.34 auf 987.78 px. Explizite Logo-, Navigations- und Kontaktspalten reservieren jetzt die Geometrie unabhaengig von den Font-Metriken.
- Tablet: Die bisherige Scroll-Transformation verschob den Header um 10 px und skalierte das Logo. Sie bleibt nur auf Mobile bis 760 px aktiv. Tablet/Desktop behalten ihre Groesse und Position.
- Tablet: Eine leere dritte Grid-Spalte hielt den Burger vom rechten Rand fern. Das Tablet-Grid besitzt jetzt genau zwei Spalten.
- Tablet-Menue: Die Scrollsperre auf dem Body hob den Sticky-Bezug erneut auf. Die Sperre liegt fuer Tablets nun auf dem Viewport; Oeffnen und Schliessen verschieben den Header nicht.
- Die Header-Logo-Einfluganimation ist ab 761 px abgeschaltet. Ein stabiler Scrollleisten-Platz verhindert seitlichen Versatz bei wechselnder Seitenhoehe.
- Sprungziele erhalten zum nun tatsaechlich fixierten Desktop-Header passende Abstaende.

## Geschwindigkeit

- Header-/Fortschrittsaktualisierungen werden ueber `requestAnimationFrame` gebuendelt. Ein automatisierter Test prueft, dass 20 Scrollereignisse und ein Resize nur einen Frame planen.
- Hero-Bildreferenzen werden einmal ermittelt. Seiten ohne entsprechendes Bild registrieren keinen Parallax-Scrollhandler. Unveraenderte Offsets verursachen keine weiteren Style-Schreibzugriffe.
- Vorhandene Gzip-Kompression, Cache-Revalidierung, lokale Fonts, SSR-Inhalte und verzoegertes Kartenladen bleiben erhalten und wurden geprueft.
- Keine neue Produktionsabhaengigkeit installiert.

Lokale Browser-Stichprobe: Edge/Chromium, 1440 x 900, neuer Browser-Kontext je Seite, warmer lokaler Server, ohne Netz-/CPU-Drosselung. Werte sind keine Feldmessung und keine Render-Kaltstartmessung.

| Seite | CLS | beobachteter LCP | geladene Ressourcen | Ressourcentransfer |
| --- | ---: | ---: | ---: | ---: |
| Home | 0 | 204 ms | 19 | ca. 1.29 MB |
| Leistungen | 0 | 1128 ms | 19 | ca. 1.23 MB |
| Pakete | 0 | 132 ms | 11 | ca. 113 KB |
| Kontakt | 0 | 140 ms | 11 | ca. 113 KB |

In dieser Stichprobe keine externen Ressourcen vor Interaktion. Home und Leistungen enthalten naturgemaess mehr Bilddaten. Die Werte belegen keine pauschale prozentuale Beschleunigung; Mobilfunk, langsame Geraete und Hosting-Kaltstarts koennen deutlich abweichen.

## Sicherheits- und Funktionspruefung

- `npm audit --json`: 0 gemeldete bekannte Schwachstellen, einschliesslich Entwicklungsabhaengigkeiten.
- `npm run check`: 39 Tests bestanden sowie Struktur-/UI-Pruefungen fuer 14 HTML-Seiten und sieben Leistungen.
- Geprueft: Traversal-/private Dateizugriffe, fehlerhafte URLs, HTTP-Methoden, Sicherheitsheader, CSP, Host-Header-Manipulation, SSR-Escaping und oeffentliche Konfigurations-Allowlist.
- Geprueft: Origin-/Content-Type-Kontrolle, Request-Groessen, Eingabevalidierung, Honeypot, Rate-Limit und Umgang mit gefaelschten Forwarded-Adressen.
- Geprueft: fester Mail-Empfaenger, HTML-Escaping, Reply-To, Providerfehler, keine Erfolgsmeldung ohne bestaetigten Versand und keine Speicherung von Anfrageinhalten in Dateien.
- `.env` ist ignoriert und nicht versioniert; nur `.env.example` ist versioniert. Keine echten Zugangsdaten in den Bericht aufgenommen.
- Kein echter Mailversand ausgefuehrt oder neu aktiviert. Sicherheitspruefungen wurden lokal ausgefuehrt, kein Lasttest gegen die Live-Seite.

Dies ist eine Code-/Regressionspruefung, kein unabhaengiger Penetrationstest und keine Garantie auf vollstaendige Sicherheit.

## Browser-Regression

- Alle 13 Seiten mit Hauptheader verglichen: 768, 1024, 1051, 1100, 1280, 1440, 1920 und 2560 px; gleiche Positionen/Groessen innerhalb eines Viewports vor und nach Scrollen.
- Verzoegerte Font-Antworten: 768, 1100, 1440 und 1920 px, keine Verschiebung der reservierten Header-Elemente.
- Tablet-Menue aus gescrollter Position, Escape, bestehende Animationen, Desktop-FAQ-/Leistungsanker und Formular-Paketuebergabe geprueft.
- Mobile-Regressionspruefung: 360, 375, 390 und 430 px. Das kompakte Mobile-Verhalten bleibt erhalten.
- WebKit: vier Hauptseiten bei 768, 1024 und 1440 px, inklusive Scrollen. Browser-Emulation, kein physisches Safari-/iPad-Geraet.
- Keine Browser-Konsolenfehler im Chromium-Durchlauf.
- `npm run check:header`: neuer wiederholbarer Browser-Test fuer alle Header, Scrollen, Tablet-Menue und verzoegerte Fonts. Externe Playwright-Testumgebung erforderlich, siehe README.

## Noch keine fachliche Produktionsfreigabe

`npm run check:launch` bleibt absichtlich negativ: Firmen-/Adress-/Kontaktangaben und Oeffnungszeiten sind Platzhalter, Rechtstexte benoetigen Betreiberfreigabe, der Mailversand ist zurueckgestellt und Suchmaschinenindexierung deaktiviert. Echte Paketbestandteile sind weiterhin nicht eingetragen. Diese Angaben wurden nicht erfunden oder automatisch freigeschaltet.

Vor echtem Kundenbetrieb: Betriebsdaten und Rechtsangaben bestaetigen, Mailversand separat einrichten und einen echten Posteingangstest durchfuehren, danach Indexierung bewusst freigeben. Die aktuelle Vorschau bleibt oeffentlich erreichbar, aber ohne Suchmaschinenfreigabe.
