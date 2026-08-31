const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config({ quiet: true });
const business = require("../frontend/js/business");
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "../backend/data/site.json"), "utf8"));
const missing = [];
const placeholder = (value) => !String(value || "").trim() || /\[[^\]]+\]|\.example\b/.test(String(value));
for (const [label, value] of Object.entries({
  Firmenname: config.siteName,
  Kurzname: config.shortName,
  "E-Mail": config.email,
  Straße: config.address?.street,
  PLZ: config.address?.zip,
  Ort: config.address?.city,
})) {
  if (placeholder(value)) missing.push(`${label}: echte Betriebsangabe fehlt`);
}
if (!business.hasUsablePhone(config.phone)) missing.push("Telefon: echte Nummer fehlt");
if (!business.hasUsableEmail(config.email)) missing.push("E-Mail: gültige Betriebsadresse fehlt");
if (!business.hasUsableWhatsapp(config.whatsapp)) missing.push("WhatsApp: gültige Nummer fehlt");
if (!config.openingHours?.length || config.openingHours.some((item) => placeholder(item.hours)))
  missing.push("Öffnungszeiten: Bestätigung fehlt");
for (const field of ["owner", "legalForm", "contentResponsible"]) {
  if (placeholder(config.legal?.[field])) missing.push(`Rechtsangabe ${field}: fehlt`);
}
for (const field of ["register", "vatId"]) {
  if (config.legal?.[field] && placeholder(config.legal[field]))
    missing.push(`Rechtsangabe ${field}: klären oder leer lassen, wenn nicht zutreffend`);
}
if (config.legal?.reviewed !== true)
  missing.push("Impressum/Datenschutz: finale Prüfung und Freigabe fehlen");
if (!business.safeHttps(config.publicUrl)) missing.push("Domain: gültige HTTPS-Adresse fehlt");
const env = process.env;
const transportReady =
  env.MAIL_TRANSPORT === "resend"
    ? Boolean(env.RESEND_API_KEY)
    : (!env.MAIL_TRANSPORT || env.MAIL_TRANSPORT === "smtp") &&
      Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
if (!transportReady || !business.hasUsableEmail(env.MAIL_FROM_EMAIL || env.SMTP_FROM_EMAIL))
  missing.push("E-Mail-Versand: Einrichtung fehlt (bewusst zurückgestellt)");
if (!business.hasUsableEmail(env.INQUIRY_RECIPIENT || config.email))
  missing.push("E-Mail-Empfänger: gültige Zieladresse fehlt");
if (config.indexingEnabled !== true) missing.push("Suchmaschinen: Indexierung noch nicht freigegeben");
if (missing.length) {
  console.error("Noch keine Produktionsfreigabe:\n- " + missing.join("\n- "));
  process.exitCode = 1;
} else {
  console.log(
    "Automatische Vorprüfung bestanden. Betreiberfreigabe, Rechtstextprüfung und echter Posteingangstest bleiben erforderlich.",
  );
}
