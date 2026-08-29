const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const frontend = path.join(root, "frontend");
const htmlFiles = fs.readdirSync(frontend).filter((file) => file.endsWith(".html"));
const errors = [];

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

const config = JSON.parse(fs.readFileSync(path.join(root, "backend", "data", "site.json"), "utf8"));
const slugs = new Set();
for (const service of config.services) {
  for (const key of ["slug", "title", "summary", "image", "imageAlt", "suitableFor", "benefits", "steps", "highlights"]) {
    if (!service[key] || !service[key].length) errors.push(`Service ${service.slug || "ohne Slug"}: ${key} fehlt`);
  }
  if (slugs.has(service.slug)) errors.push(`Service-Slug doppelt: ${service.slug}`);
  slugs.add(service.slug);
  if (!fs.existsSync(path.join(frontend, `${service.slug}.html`))) errors.push(`Leistungsseite fehlt: ${service.slug}.html`);
  if (service.image && !existsForUrl(service.image)) errors.push(`Service-Bild fehlt: ${service.image}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`${htmlFiles.length} HTML-Seiten und ${config.services.length} Leistungsbereiche geprueft.`);
