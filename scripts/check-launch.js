const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config({ quiet: true });
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "../backend/data/site.json"), "utf8"));
const missing = [];
const placeholder = (value) => !String(value || "").trim() || /\[[^\]]+\]|\.example\b/.test(String(value));
for (const [label, value] of Object.entries({
  Firmenname: config.siteName,
  "E-Mail": config.email,
  Straße: config.address?.street,
  PLZ: config.address?.zip,
  Ort: config.address?.city,
})) {
  if (placeholder(value)) missing.push(`${label}: echte Betriebsangabe fehlt`);
}
if (!config.phone || !/[1-9]/.test(config.phone.replace(/^\+49/, "")))
  missing.push("Telefon: echte Nummer fehlt");
if (config.openingHours.some((item) => placeholder(item.hours)))
  missing.push("Öffnungszeiten: Bestätigung fehlt");
for (const file of ["impressum.html", "datenschutz.html"]) {
  if (/\[[^\]]+\]/.test(fs.readFileSync(path.join(__dirname, "../frontend", file), "utf8")))
    missing.push(`${file}: Betreiber-/Rechtsangaben fehlen`);
}
const env = process.env;
const transportReady =
  env.MAIL_TRANSPORT === "resend"
    ? Boolean(env.RESEND_API_KEY)
    : (!env.MAIL_TRANSPORT || env.MAIL_TRANSPORT === "smtp") &&
      Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
if (!transportReady || !(env.MAIL_FROM_EMAIL || env.SMTP_FROM_EMAIL))
  missing.push("E-Mail-Versand: Einrichtung fehlt (bewusst zurückgestellt)");
if (config.indexingEnabled !== true) missing.push("Suchmaschinen: Indexierung noch nicht freigegeben");
if (missing.length) {
  console.error("Noch keine Produktionsfreigabe:\n- " + missing.join("\n- "));
  process.exitCode = 1;
} else {
  console.log(
    "Automatische Vorprüfung bestanden. Betreiberfreigabe, Rechtstextprüfung und echter Posteingangstest bleiben erforderlich.",
  );
}
