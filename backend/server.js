const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config({ quiet: true });
const { sendInquiryEmail } = require("./mailer");

const PORT = Number(process.env.PORT || 3100);
const ROOT = path.join(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT, "frontend");
const CONFIG_FILE = path.join(__dirname, "data", "site.json");
const inquiryAttempts = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function send(res, statusCode, body, contentType = "text/plain; charset=utf-8", headers = {}) {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'",
    ...headers
  });
  res.end(body);
}

function sanitizeSegment(value) {
  return String(value || "").replace(/^\/+/, "").replace(/\\/g, "/");
}

function resolveStaticPath(urlPath) {
  const cleanPath = decodeURIComponent(sanitizeSegment(urlPath.split("?")[0]));
  const candidate = cleanPath === "" ? "index.html" : cleanPath;
  const filePath = path.normalize(path.join(FRONTEND_DIR, candidate));
  if (!filePath.startsWith(FRONTEND_DIR)) return null;

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath;
  if (!path.extname(filePath)) {
    const htmlPath = `${filePath}.html`;
    if (fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) return htmlPath;
  }
  return null;
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function handleSitemap(req, res) {
  const config = readJson(CONFIG_FILE);
  const origin = `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
  const baseUrl = config.publicUrl && !config.publicUrl.includes("example")
    ? config.publicUrl.replace(/\/+$/, "")
    : origin;
  const today = new Date().toISOString().slice(0, 10);
  const pages = [
    "/",
    "/leistungen.html",
    "/felgenreparatur.html",
    "/lackaufbereitung.html",
    "/innenreinigung.html",
    "/aussenreinigung.html",
    "/komplettaufbereitung.html",
    "/keramikversiegelung.html",
    "/leasing.html",
    "/preise.html",
    "/kontakt.html"
  ];
  const urls = pages.map((page, index) => [
    "  <url>",
    `    <loc>${escapeXml(`${baseUrl}${page}`)}</loc>`,
    `    <lastmod>${today}</lastmod>`,
    "    <changefreq>weekly</changefreq>",
    `    <priority>${index === 0 ? "1.0" : "0.8"}</priority>`,
    "  </url>"
  ].join("\n")).join("\n");
  send(res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, MIME_TYPES[".xml"], { "Cache-Control": "public, max-age=3600" });
}

function handleRobots(req, res) {
  const origin = `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
  send(res, 200, `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`, MIME_TYPES[".txt"], { "Cache-Control": "public, max-age=3600" });
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20000) {
        req.destroy();
        reject(new Error("Request too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleInquiry(req, res) {
  try {
    const clientIp = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
    const now = Date.now();
    const recentAttempts = (inquiryAttempts.get(clientIp) || []).filter((time) => now - time < 10 * 60 * 1000);
    if (recentAttempts.length >= 5) {
      send(res, 429, JSON.stringify({ error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut oder nutzen Sie Telefon beziehungsweise WhatsApp." }), MIME_TYPES[".json"]);
      return;
    }
    recentAttempts.push(now);
    inquiryAttempts.set(clientIp, recentAttempts);

    const raw = await collectRequestBody(req);
    const payload = JSON.parse(raw || "{}");
    if (String(payload.website || "").trim()) {
      send(res, 200, JSON.stringify({ success: true, emailSent: false, emailStatus: "filtered" }), MIME_TYPES[".json"]);
      return;
    }
    const clean = (value, max) => String(value || "").trim().slice(0, max);
    const inquiry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      name: clean(payload.name, 90),
      phone: clean(payload.phone, 40),
      email: clean(payload.email, 120),
      vehicle: clean(payload.vehicle, 120),
      service: clean(payload.service, 80),
      preferredContact: clean(payload.preferredContact, 40),
      message: clean(payload.message, 1200)
    };

    const emailIsValid = !inquiry.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inquiry.email);
    if (inquiry.name.length < 2 || inquiry.phone.length < 5 || !emailIsValid || payload.privacy !== "accepted") {
      send(res, 400, JSON.stringify({ error: "Bitte Pflichtfelder ausfüllen und die Datenschutzhinweise bestätigen." }), MIME_TYPES[".json"]);
      return;
    }

    const target = path.join(__dirname, "data", "inquiries.json");
    const existing = fs.existsSync(target) ? readJson(target) : [];
    existing.unshift(inquiry);
    fs.writeFileSync(target, JSON.stringify(existing.slice(0, 200), null, 2), "utf8");
    const siteConfig = readJson(CONFIG_FILE);
    let emailResult;
    try {
      emailResult = await sendInquiryEmail(inquiry, siteConfig);
    } catch (error) {
      console.error("E-Mail-Versand der Anfrage fehlgeschlagen:", error.message);
      emailResult = { sent: false, reason: "delivery_failed" };
    }
    send(res, emailResult.sent ? 200 : 202, JSON.stringify({
      success: true,
      id: inquiry.id,
      emailSent: emailResult.sent,
      emailStatus: emailResult.reason || "sent"
    }), MIME_TYPES[".json"]);
  } catch {
    send(res, 500, JSON.stringify({ error: "Anfrage konnte nicht gespeichert werden." }), MIME_TYPES[".json"]);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/config") {
    send(res, 200, fs.readFileSync(CONFIG_FILE, "utf8"), MIME_TYPES[".json"], { "Cache-Control": "no-store" });
    return;
  }
  if (req.method === "GET" && url.pathname === "/health") {
    send(res, 200, JSON.stringify({ status: "ok" }), MIME_TYPES[".json"], { "Cache-Control": "no-store" });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/inquiry") {
    await handleInquiry(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/robots.txt") return handleRobots(req, res);
  if (req.method === "GET" && url.pathname === "/sitemap.xml") return handleSitemap(req, res);

  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method not allowed");
    return;
  }

  const filePath = resolveStaticPath(url.pathname);
  if (!filePath) {
    const notFoundFile = path.join(FRONTEND_DIR, "404.html");
    send(res, 404, fs.readFileSync(notFoundFile, "utf8"), MIME_TYPES[".html"], { "Cache-Control": "no-cache" });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const cache = [".html", ".css", ".js"].includes(ext)
    ? "no-cache"
    : "public, max-age=604800, stale-while-revalidate=86400";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'"
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Autoaufbereitung Website läuft auf http://localhost:${PORT}`);
});
