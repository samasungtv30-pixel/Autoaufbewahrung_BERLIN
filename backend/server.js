const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { isIP } = require("node:net");
const { gzipSync } = require("node:zlib");
require("dotenv").config({ quiet: true });
const { sendInquiryEmail } = require("./mailer");
const { renderHtml, publicConfig } = require("./render");
const { validInquiryPhone } = require("../frontend/js/business");

const PORT = Number(process.env.PORT || 3100);
const ROOT = path.join(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT, "frontend");
const CONFIG_FILE = path.join(__dirname, "data", "site.json");
const inquiryAttempts = new Map();
const rateLimitSalt = crypto.randomBytes(32);
const RATE_LIMIT_WINDOW = 10 * 60 * 1000;
const MAX_RATE_LIMIT_KEYS = 10000;
const MAX_BODY_BYTES = 20000;
const compressedResponses = new Map();
const TRUST_PROXY_HOPS = Number(process.env.TRUST_PROXY_HOPS || (process.env.RENDER === "true" ? 1 : 0));
// Only short-lived abuse counters are retained, never inquiry contents or raw IPs.
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW;
  for (const [key, attempts] of inquiryAttempts) {
    if (attempts[attempts.length - 1] <= cutoff) inquiryAttempts.delete(key);
  }
}, 60 * 1000).unref();
const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://www.google.com; object-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

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
  ".xml": "application/xml; charset=utf-8",
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    ...(process.env.NODE_ENV === "production" ? { "Strict-Transport-Security": "max-age=31536000" } : {}),
  };
}

function send(res, statusCode, body, contentType = "text/plain; charset=utf-8", headers = {}) {
  const request = res.req;
  const compressible = /^(text\/|application\/(javascript|json)|image\/svg)/.test(contentType);
  const cacheable =
    request?.method === "GET" &&
    statusCode === 200 &&
    !String(headers["Cache-Control"] || "").includes("no-store");
  if (compressible && cacheable) {
    headers = { ...headers, Vary: "Accept-Encoding" };
    const acceptsGzip = String(request.headers["accept-encoding"] || "")
      .split(",")
      .some((part) => {
        const [coding, quality] = part.trim().split(/\s*;\s*q=/);
        return coding === "gzip" && (quality === undefined || Number(quality) > 0);
      });
    if (acceptsGzip && Buffer.byteLength(body) >= 1024) {
      const key = crypto.createHash("sha256").update(body).digest("hex");
      let compressed = compressedResponses.get(key);
      if (!compressed) {
        compressed = gzipSync(body);
        if (compressedResponses.size >= 24) compressedResponses.clear();
        compressedResponses.set(key, compressed);
      }
      body = compressed;
      headers["Content-Encoding"] = "gzip";
    }
  }
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    ...securityHeaders(),
    ...headers,
  });
  res.end(body);
}

function resolveStaticPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath);
  if (/[\x00-\x1f\\:]/.test(cleanPath)) return null;
  const segments = cleanPath.split("/").filter(Boolean);
  if (segments.some((segment) => segment.startsWith("."))) return null;
  const filePath = path.resolve(FRONTEND_DIR, segments.join("/") || "index.html");
  const relative = path.relative(FRONTEND_DIR, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath;
  if (!path.extname(filePath)) {
    const htmlPath = `${filePath}.html`;
    if (fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) return htmlPath;
  }
  return null;
}

function publicOrigin() {
  const url = new URL(readJson(CONFIG_FILE).publicUrl);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid public URL");
  return url.origin;
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
  const baseUrl = publicOrigin();
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
    "/kontakt.html",
  ];
  const activePages = pages.filter((page) => {
    const service = config.services.find((item) => page === `/${item.slug}.html`);
    return !service || service.active !== false;
  });
  const urls = activePages
    .map((page, index) =>
      [
        "  <url>",
        `    <loc>${escapeXml(`${baseUrl}${page}`)}</loc>`,
        "    <changefreq>weekly</changefreq>",
        `    <priority>${index === 0 ? "1.0" : "0.8"}</priority>`,
        "  </url>",
      ].join("\n"),
    )
    .join("\n");
  send(
    res,
    200,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    MIME_TYPES[".xml"],
    { "Cache-Control": "public, max-age=3600" },
  );
}

function handleRobots(req, res) {
  const origin = publicOrigin();
  send(res, 200, `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`, MIME_TYPES[".txt"], {
    "Cache-Control": "public, max-age=3600",
  });
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on("data", (chunk) => {
      if (tooLarge) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        reject(Object.assign(new Error("Request too large"), { statusCode: 413 }));
        return;
      }
      chunks.push(bytes);
    });
    req.on("end", () => {
      if (!tooLarge) resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("aborted", () => reject(new Error("Request aborted")));
    req.on("error", reject);
  });
}

function clientAddress(req) {
  const remote = req.socket.remoteAddress || "unknown";
  // Trust only a configured number of proxy hops, never arbitrary leftmost values.
  if (!Number.isInteger(TRUST_PROXY_HOPS) || TRUST_PROXY_HOPS < 1) return remote;
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((value) => value.trim());
  const candidate = forwarded[forwarded.length - TRUST_PROXY_HOPS];
  return candidate && isIP(candidate) ? candidate : remote;
}

function allowedOrigin(origin) {
  if (origin === publicOrigin()) return true;
  if (process.env.NODE_ENV === "production") return false;
  return [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`].includes(origin);
}

async function handleInquiry(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") {
      send(
        res,
        415,
        JSON.stringify({ error: "Bitte senden Sie das Formular als JSON." }),
        MIME_TYPES[".json"],
      );
      return;
    }
    if (
      req.headers["sec-fetch-site"] === "cross-site" ||
      (req.headers.origin && !allowedOrigin(req.headers.origin))
    ) {
      send(
        res,
        403,
        JSON.stringify({ error: "Anfrage von dieser Herkunft nicht erlaubt." }),
        MIME_TYPES[".json"],
      );
      return;
    }
    if (Number(req.headers["content-length"]) > MAX_BODY_BYTES) {
      send(res, 413, JSON.stringify({ error: "Die Anfrage ist zu groß." }), MIME_TYPES[".json"]);
      return;
    }
    const clientIp = clientAddress(req);
    const clientKey = crypto.createHmac("sha256", rateLimitSalt).update(clientIp).digest("hex");
    const now = Date.now();
    const recentAttempts = (inquiryAttempts.get(clientKey) || []).filter(
      (time) => now - time < RATE_LIMIT_WINDOW,
    );
    if (
      recentAttempts.length >= 5 ||
      (!inquiryAttempts.has(clientKey) && inquiryAttempts.size >= MAX_RATE_LIMIT_KEYS)
    ) {
      send(
        res,
        429,
        JSON.stringify({
          error:
            "Zu viele Anfragen. Bitte versuchen Sie es später erneut oder nutzen Sie Telefon beziehungsweise WhatsApp.",
        }),
        MIME_TYPES[".json"],
        { "Retry-After": "600" },
      );
      return;
    }
    recentAttempts.push(now);
    inquiryAttempts.set(clientKey, recentAttempts);

    const raw = await collectRequestBody(req);
    let payload;
    try {
      payload = JSON.parse(raw || "{}");
    } catch {
      send(
        res,
        400,
        JSON.stringify({ error: "Ungültige Anfrage. Bitte prüfen Sie Ihre Eingaben." }),
        MIME_TYPES[".json"],
      );
      return;
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      send(
        res,
        400,
        JSON.stringify({ error: "Ungültige Anfrage. Bitte prüfen Sie Ihre Eingaben." }),
        MIME_TYPES[".json"],
      );
      return;
    }
    if (String(payload.website || "").trim()) {
      send(
        res,
        200,
        JSON.stringify({ success: true, emailSent: false, emailStatus: "filtered" }),
        MIME_TYPES[".json"],
      );
      return;
    }
    const limits = {
      name: 90,
      phone: 40,
      email: 120,
      vehicle: 120,
      service: 80,
      preferredContact: 40,
      message: 1200,
    };
    if (
      Object.entries(limits).some(
        ([key, max]) =>
          payload[key] !== undefined &&
          (typeof payload[key] !== "string" ||
            payload[key].length > max ||
            /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(payload[key])),
      )
    ) {
      send(
        res,
        400,
        JSON.stringify({ error: "Bitte prüfen Sie Format und Länge Ihrer Eingaben." }),
        MIME_TYPES[".json"],
      );
      return;
    }
    const clean = (value, max) =>
      String(value || "")
        .trim()
        .slice(0, max);
    const inquiry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      name: clean(payload.name, 90),
      phone: clean(payload.phone, 40),
      email: clean(payload.email, 120),
      vehicle: clean(payload.vehicle, 120),
      service: clean(payload.service, 80),
      preferredContact: clean(payload.preferredContact, 40),
      message: clean(payload.message, 1200),
    };

    const emailIsValid = !inquiry.email || /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(inquiry.email);
    const phoneIsValid = validInquiryPhone(inquiry.phone);
    if (inquiry.name.length < 2 || !phoneIsValid || !emailIsValid || payload.privacy !== "accepted") {
      send(
        res,
        400,
        JSON.stringify({ error: "Bitte Pflichtfelder ausfüllen und die Datenschutzhinweise bestätigen." }),
        MIME_TYPES[".json"],
      );
      return;
    }

    const siteConfig = readJson(CONFIG_FILE);
    let emailResult;
    try {
      emailResult = await sendInquiryEmail(inquiry, siteConfig);
    } catch {
      // Provider errors can contain addresses or message contents. Do not log them.
      console.error("E-Mail-Versand der Anfrage fehlgeschlagen.");
      emailResult = { sent: false, reason: "delivery_failed" };
    }
    if (!emailResult.sent) {
      send(
        res,
        503,
        JSON.stringify({
          success: false,
          emailSent: false,
          error:
            "Der E-Mail-Versand konnte nicht bestätigt werden. Ihre Eingaben bleiben im Formular. Bitte versuchen Sie es später erneut.",
        }),
        MIME_TYPES[".json"],
      );
      return;
    }
    send(
      res,
      200,
      JSON.stringify({
        success: true,
        id: inquiry.id,
        emailSent: emailResult.sent,
        emailStatus: emailResult.reason || "sent",
      }),
      MIME_TYPES[".json"],
    );
  } catch (error) {
    if (!res.destroyed)
      send(
        res,
        error.statusCode === 413 ? 413 : 500,
        JSON.stringify({
          error:
            error.statusCode === 413
              ? "Die Anfrage ist zu groß."
              : "Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.",
        }),
        MIME_TYPES[".json"],
      );
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url?.startsWith("/") || req.url.startsWith("//")) {
      send(res, 400, "Bad request");
      return;
    }
    const url = new URL(req.url, "http://localhost");
    decodeURIComponent(url.pathname);
    const config = readJson(CONFIG_FILE);
    if (config.indexingEnabled !== true) res.setHeader("X-Robots-Tag", "noindex, nofollow");

    const readOnly = req.method === "GET" || req.method === "HEAD";
    if (readOnly && url.pathname === "/api/config") {
      send(res, 200, JSON.stringify(publicConfig(config)), MIME_TYPES[".json"], {
        "Cache-Control": "no-store",
      });
      return;
    }
    if (readOnly && url.pathname === "/health") {
      send(res, 200, JSON.stringify({ status: "ok" }), MIME_TYPES[".json"], { "Cache-Control": "no-store" });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/inquiry") {
      await handleInquiry(req, res);
      return;
    }
    if (readOnly && url.pathname === "/robots.txt") return handleRobots(req, res);
    if (readOnly && url.pathname === "/sitemap.xml") return handleSitemap(req, res);

    if (url.pathname === "/api/inquiry") {
      send(res, 405, "Method not allowed", MIME_TYPES[".txt"], { Allow: "POST" });
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      send(res, 405, "Method not allowed", MIME_TYPES[".txt"], { Allow: "GET, HEAD" });
      return;
    }

    const filePath = resolveStaticPath(url.pathname);
    if (!filePath) {
      const notFoundFile = path.join(FRONTEND_DIR, "404.html");
      send(res, 404, req.method === "HEAD" ? "" : renderHtml(notFoundFile, config), MIME_TYPES[".html"], {
        "Cache-Control": "no-cache",
        "X-Robots-Tag": "noindex",
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const canonicalPath =
      filePath === path.join(FRONTEND_DIR, "index.html")
        ? "/"
        : `/${path.relative(FRONTEND_DIR, filePath).split(path.sep).join("/")}`;
    if (ext === ".html" && url.pathname !== canonicalPath) {
      send(res, 308, "", MIME_TYPES[".txt"], { Location: `${canonicalPath}${url.search}` });
      return;
    }
    if (
      ext === ".html" &&
      config.services.some((item) => `${item.slug}.html` === path.basename(filePath) && item.active === false)
    ) {
      send(
        res,
        404,
        req.method === "HEAD" ? "" : renderHtml(path.join(FRONTEND_DIR, "404.html"), config),
        MIME_TYPES[".html"],
        { "Cache-Control": "no-cache", "X-Robots-Tag": "noindex" },
      );
      return;
    }
    if (ext === ".html") {
      send(res, 200, req.method === "HEAD" ? "" : renderHtml(filePath, config), MIME_TYPES[".html"], {
        "Cache-Control": "no-cache",
      });
      return;
    }
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const cache = [".html", ".css", ".js"].includes(ext)
      ? "no-cache"
      : "public, max-age=604800, stale-while-revalidate=86400";
    const stat = fs.statSync(filePath);
    const etag = `W/"${stat.size}-${stat.mtimeMs}"`;
    if (req.headers["if-none-match"] === etag) {
      send(res, 304, "", contentType, { "Cache-Control": cache, ETag: etag, Vary: "Accept-Encoding" });
      return;
    }
    if ([".css", ".js", ".svg", ".json", ".txt"].includes(ext)) {
      send(res, 200, req.method === "HEAD" ? "" : fs.readFileSync(filePath), contentType, {
        "Cache-Control": cache,
        ETag: etag,
      });
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": cache,
      ETag: etag,
      ...securityHeaders(),
    });
    if (req.method === "HEAD") return res.end();
    const stream = fs.createReadStream(filePath);
    stream.on("error", () => res.destroy());
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  } catch (error) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    send(
      res,
      error instanceof URIError || error instanceof TypeError ? 400 : 500,
      "Die Anfrage konnte nicht verarbeitet werden.",
      MIME_TYPES[".txt"],
      { "Cache-Control": "no-store" },
    );
  }
});

server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 5000;
server.listen(PORT, () => {
  console.log(`Autoaufbereitung Website läuft auf http://localhost:${server.address().port}`);
});
