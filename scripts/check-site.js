const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const frontend = path.join(root, "frontend");
const htmlFiles = fs.readdirSync(frontend).filter((file) => file.endsWith(".html"));
const errors = [];
const publicCopyFiles = [
  ...htmlFiles.map((file) => path.join(frontend, file)),
  path.join(frontend, "js", "main.js"),
  path.join(root, "backend", "data", "site.json")
];
const forbiddenPublicCopy = [
  { pattern: /neu\s+(?:eröffnet|eroeffnet)|neu eröffneter|neu eroeffneter/i, label: "unbestätigte Neueröffnungs-Aussage" },
  { pattern: /Go-Live|Prüffassung|Prueffassung|Kundenfreigabe|Kundendaten|Paketstruktur|Leistungsstruktur|vorbereiteter Leistungsbereich|wird noch eingerichtet/i, label: "interner Entwicklungsbegriff" },
  { pattern: /\b(?:fuer|spaeter|eroeffnet|Qualitaet|Flaeche|koennen|persoenlich|Rueckmeldung|Einschaetzung|Pruefung|Uebergabe|Oeffnungszeiten|gewuenscht\w*|Moeglich\w*)\b/, label: "ASCII-Ersatzschreibweise" }
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
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  if (h1Count !== 1) errors.push(`${file}: erwartet genau eine H1, gefunden ${h1Count}`);

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/gi)) {
    const url = match[1];
    if (/^(?:https?:|mailto:|tel:|#|data:)/i.test(url)) continue;
    if (url.startsWith("/") && !existsForUrl(url)) errors.push(`${file}: Ziel fehlt ${url}`);
  }

  if (/neu\s+(?:eroeffnet|eröffnet|geoeffnet|geöffnet)|neuer\s+betrieb/i.test(html)) {
    errors.push(`${file}: unbestaetigte Neueröffnungs-Aussage gefunden`);
  }
}

for (const file of publicCopyFiles) {
  const content = fs.readFileSync(file, "utf8");
  for (const rule of forbiddenPublicCopy) {
    if (rule.pattern.test(content)) errors.push(`${path.relative(root, file)}: ${rule.label} gefunden`);
  }
}

const config = JSON.parse(fs.readFileSync(path.join(root, "backend", "data", "site.json"), "utf8"));
const slugs = new Set();
for (const service of config.services) {
  for (const key of ["slug", "title", "summary", "image", "imageAlt", "accent", "cardSteps", "suitableFor", "benefits", "steps", "highlights"]) {
    if (!service[key] || !service[key].length) errors.push(`Service ${service.slug || "ohne Slug"}: ${key} fehlt`);
  }
  if (slugs.has(service.slug)) errors.push(`Service-Slug doppelt: ${service.slug}`);
  slugs.add(service.slug);
  if (!fs.existsSync(path.join(frontend, `${service.slug}.html`))) errors.push(`Leistungsseite fehlt: ${service.slug}.html`);
  if (service.image && !existsForUrl(service.image)) errors.push(`Service-Bild fehlt: ${service.image}`);
  if (typeof service.active !== "boolean") errors.push(`Service ${service.slug}: active muss true oder false sein`);
  if (!/^#[0-9a-f]{6}$/i.test(service.accent || "")) errors.push(`Service ${service.slug}: ungültige Akzentfarbe`);
  if (!["lime", "blue", "orange", "violet", "red", "teal", "yellow"].includes(service.theme)) errors.push(`Service ${service.slug}: ungültiges Farbthema`);
  if (!Array.isArray(service.cardSteps) || service.cardSteps.length !== 2) errors.push(`Service ${service.slug}: genau zwei Kartenschritte erforderlich`);
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
