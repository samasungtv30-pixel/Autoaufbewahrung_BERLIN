const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const frontend = path.join(root, "frontend");
const htmlFiles = fs.readdirSync(frontend).filter((file) => file.endsWith(".html"));
const errors = [];
const publicCopyFiles = [
  ...htmlFiles.map((file) => path.join(frontend, file)),
  path.join(frontend, "js", "main.js"),
  path.join(frontend, "js", "site-data.js"),
  path.join(root, "backend", "data", "site.json")
];
const forbiddenPublicCopy = [
  { pattern: /neu\s+(?:eröffnet|eroeffnet)|neu eröffneter|neu eroeffneter/i, label: "unbestätigte Neueröffnungs-Aussage" },
  { pattern: /Go-Live|Prüffassung|Prueffassung|Kundenfreigabe|Kundendaten|Paketstruktur|Leistungsstruktur|vorbereiteter Leistungsbereich|wird noch eingerichtet|wird aktuell .{0,50}(?:abgestimmt|bestätigt)|finaler? Betriebsablauf/i, label: "interner Entwicklungsbegriff" },
  { pattern: /\b(?:fuer|spaeter|eroeffnet|Qualitaet|Flaeche|koennen|persoenlich|Rueckmeldung|Einschaetzung|Pruefung|pruefen|Uebergabe|Oeffnungszeiten|gewuenscht\w*|Moeglich\w*|Aussen\w*|Strasse)\b/, label: "ASCII-Ersatzschreibweise" }
];

function existsForUrl(url) {
  const pathname = url.split(/[?#]/)[0];
  if (!pathname || pathname === "/") return true;
  const relative = pathname.replace(/^\//, "");
  return fs.existsSync(path.join(frontend, relative));
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(frontend, file), "utf8");
  if (!/<title>[^<]+<\/title>/i.test(html)) errors.push(`${file}: title fehlt`);
  if (!/<meta\s+name="description"\s+content="[^"]+"/i.test(html)) errors.push(`${file}: Meta Description fehlt`);
  if (!/<meta\s+name="viewport"/i.test(html)) errors.push(`${file}: Viewport Meta fehlt`);
  if (!html.includes("data-brand-logo")) errors.push(`${file}: gemeinsames Logo fehlt`);
  if (html.includes('class="brand-mark"')) errors.push(`${file}: altes Logo-Kürzel gefunden`);
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  if (h1Count !== 1) errors.push(`${file}: erwartet genau eine H1, gefunden ${h1Count}`);

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/gi)) {
    const url = match[1];
    if (/^(?:https?:|mailto:|tel:|#|data:)/i.test(url)) continue;
    if (url.startsWith("/") && !existsForUrl(url)) errors.push(`${file}: Ziel fehlt ${url}`);
  }

  for (const match of html.matchAll(/data-service-icon="([a-z0-9-]+)"/gi)) {
    if (!fs.existsSync(path.join(frontend, "icons", `${match[1]}.svg`))) errors.push(`${file}: Icon fehlt ${match[1]}.svg`);
  }

  if (/neu\s+(?:eroeffnet|eröffnet|geoeffnet|geöffnet)|neuer\s+betrieb/i.test(html)) {
    errors.push(`${file}: unbestaetigte Neueröffnungs-Aussage gefunden`);
  }
  if (/href="\/galerie\.html"/i.test(html)) errors.push(`${file}: öffentlicher Galerie-Link gefunden`);
}

const contactHtml = fs.readFileSync(path.join(frontend, "kontakt.html"), "utf8");
for (const marker of ["data-map-load", "data-map-frame", "name=\"vehicle\"", "data-opening-hours", "id=\"inquiry-form\""]) {
  if (!contactHtml.includes(marker)) errors.push(`kontakt.html: Produktionsmarker fehlt ${marker}`);
}
if ((contactHtml.match(/class="contact-channel(?:\s[^"]*)?"/g) || []).length !== 4) errors.push("kontakt.html: vier direkte Kontaktkanäle erforderlich");

for (const file of publicCopyFiles) {
  const content = fs.readFileSync(file, "utf8");
  for (const rule of forbiddenPublicCopy) {
    if (rule.pattern.test(content)) errors.push(`${path.relative(root, file)}: ${rule.label} gefunden`);
  }
}

const config = JSON.parse(fs.readFileSync(path.join(root, "backend", "data", "site.json"), "utf8"));
if (!config.logo || !existsForUrl(config.logo) || !config.logoAlt) errors.push("Zentrales Logo oder Alternativtext fehlt");
for (const icon of ["circle-check-big", "phone", "message-circle"]) {
  if (!fs.existsSync(path.join(frontend, "icons", `${icon}.svg`))) errors.push(`Kontakt-/Checklisten-Icon fehlt: ${icon}`);
}
const slugs = new Set();
for (const service of config.services) {
  for (const key of ["slug", "navTitle", "title", "summary", "image", "imageAlt", "accent", "cardSteps", "suitableFor", "benefits", "steps", "highlights"]) {
    if (!service[key] || !service[key].length) errors.push(`Service ${service.slug || "ohne Slug"}: ${key} fehlt`);
  }
  if (slugs.has(service.slug)) errors.push(`Service-Slug doppelt: ${service.slug}`);
  slugs.add(service.slug);
  if (!fs.existsSync(path.join(frontend, `${service.slug}.html`))) errors.push(`Leistungsseite fehlt: ${service.slug}.html`);
  if (service.image && !existsForUrl(service.image)) errors.push(`Service-Bild fehlt: ${service.image}`);
  if (typeof service.active !== "boolean") errors.push(`Service ${service.slug}: active muss true oder false sein`);
  if (!/^#[0-9a-f]{6}$/i.test(service.accent || "")) errors.push(`Service ${service.slug}: ungültige Akzentfarbe`);
  if (!["lime", "blue", "orange", "violet", "red", "teal", "yellow"].includes(service.theme)) errors.push(`Service ${service.slug}: ungültiges Farbthema`);
  if (!Array.isArray(service.cardSteps) || service.cardSteps.length < 3 || service.cardSteps.length > 5) errors.push(`Service ${service.slug}: drei bis fünf Kartenschritte erforderlich`);
  for (const step of service.cardSteps || []) {
    if (!step.label || !step.icon) errors.push(`Service ${service.slug}: Kartenschritt unvollständig`);
    if (step.icon && !fs.existsSync(path.join(frontend, "icons", `${step.icon}.svg`))) errors.push(`Service-Icon fehlt: ${step.icon}.svg`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`${htmlFiles.length} HTML-Seiten und ${config.services.length} Leistungsbereiche geprueft.`);
