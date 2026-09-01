const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { gunzipSync } = require("node:zlib");
const { before, after, test } = require("node:test");

const root = path.join(__dirname, "..");
const site = JSON.parse(fs.readFileSync(path.join(root, "backend/data/site.json"), "utf8"));
let child;
let port;
let logs = "";
const fileExisted = fs.existsSync(path.join(root, "backend/data/inquiries.json"));

before(async () => {
  child = spawn(process.execPath, ["backend/server.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: "0",
      NODE_ENV: "production",
      MAIL_TRANSPORT: "disabled",
      TRUST_PROXY_HOPS: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stderr.on("data", (data) => {
    logs += data;
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Test server did not start")), 10000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", () => {
      if (!port) {
        clearTimeout(timeout);
        reject(new Error("Test server exited"));
      }
    });
    child.stdout.on("data", (data) => {
      const match = String(data).match(/localhost:(\d+)/);
      if (match) {
        port = Number(match[1]);
        clearTimeout(timeout);
        resolve();
      }
    });
  });
});

after(async () => {
  if (child && child.exitCode === null) {
    const exited = once(child, "exit");
    child.kill();
    await exited;
  }
  assert.equal(fs.existsSync(path.join(root, "backend/data/inquiries.json")), fileExisted);
  assert.ok(!logs.includes("security-test@example.invalid"));
});

function request(url, { method = "GET", headers = {}, body, chunks } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: url, method, headers, timeout: 5000 },
      (res) => {
        const parts = [];
        res.on("data", (part) => parts.push(part));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(parts).toString("utf8"),
            bytes: Buffer.concat(parts),
          }),
        );
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Test request timeout")));
    if (chunks) chunks.forEach((chunk) => req.write(chunk));
    req.end(body);
  });
}

test("malformed URLs and private files do not crash or escape the public root", async () => {
  for (const url of ["/%", "/%GG", "/%E0%A4%A"]) assert.equal((await request(url)).status, 400);
  for (const url of [
    "/.env",
    "/backend/data/site.json",
    "/backend/data/inquiries.json",
    "/%00",
    "/..%2fbackend/server.js",
    "/..%2ffrontend-private/secret.txt",
    "/%5c..%5c.env",
  ]) {
    assert.equal((await request(url)).status, 404, url);
  }
  assert.equal((await request("/health")).status, 200);
});

test("security headers, cache policy and preview indexing guard apply", async () => {
  for (const url of ["/", "/kontakt.html", "/js/main.js", "/api/config", "/health", "/does-not-exist"]) {
    const result = await request(url);
    assert.equal(result.headers["x-content-type-options"], "nosniff");
    assert.equal(result.headers["x-frame-options"], "DENY");
    assert.match(result.headers["content-security-policy"], /object-src 'none'/);
    assert.match(result.headers["strict-transport-security"], /max-age/);
    if (site.indexingEnabled !== true) assert.match(result.headers["x-robots-tag"], /noindex/);
  }
  assert.equal((await request("/api/config")).headers["cache-control"], "no-store");
  const config = JSON.parse((await request("/api/config")).body);
  if (site.packagesEnabled !== true) assert.deepEqual(config.packages, []);
  assert.ok(!Object.keys(config).some((key) => /smtp|recipient|password|secret|api.?key/i.test(key)));
});

test("canonical routes, HEAD and supported methods behave consistently", async () => {
  const alias = await request("/innenreinigung?service=innenreinigung");
  assert.equal(alias.status, 308);
  assert.equal(alias.headers.location, "/innenreinigung.html?service=innenreinigung");
  assert.equal((await request("/index.html")).headers.location, "/");
  for (const url of ["/", "/api/config", "/health", "/robots.txt", "/sitemap.xml"]) {
    const head = await request(url, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.body, "");
  }
  assert.equal((await request("/api/inquiry")).headers.allow, "POST");
  assert.equal((await request("/", { method: "DELETE" })).status, 405);
});

test("public HTML compresses without changing content and assets revalidate", async () => {
  const plain = await request("/leistungen.html");
  const compressed = await request("/leistungen.html", { headers: { "Accept-Encoding": "gzip" } });
  assert.equal(compressed.headers["content-encoding"], "gzip");
  assert.equal(compressed.headers.vary, "Accept-Encoding");
  assert.equal(gunzipSync(compressed.bytes).toString("utf8"), plain.body);
  assert.ok(compressed.bytes.length < plain.bytes.length / 2);
  assert.equal(
    (await request("/leistungen.html", { headers: { "Accept-Encoding": "gzip;q=0" } })).headers[
      "content-encoding"
    ],
    undefined,
  );
  const asset = await request("/js/main.js");
  assert.ok(asset.headers.etag);
  const cached = await request("/js/main.js", { headers: { "If-None-Match": asset.headers.etag } });
  assert.equal(cached.status, 304);
  assert.equal(cached.body, "");
  assert.equal(
    (await request("/api/config", { headers: { "Accept-Encoding": "gzip" } })).headers["content-encoding"],
    undefined,
  );
});

test("HTML includes canonical and social metadata before JavaScript", async () => {
  for (const page of ["/", "/kontakt.html", "/innenreinigung.html"]) {
    const result = await request(page, { headers: { Host: "attacker.invalid" } });
    assert.match(result.body, /<meta property="og:title" content="[^"]+">/);
    const service = site.services.find((item) => `/${item.slug}.html` === page);
    const image = service?.image || "/images/premium-hero.webp";
    assert.ok(
      result.body.includes(`<meta property="og:image" content="${new URL(site.publicUrl).origin}${image}">`),
    );
    assert.ok(result.body.includes(`<link rel="canonical" href="${new URL(site.publicUrl).origin}${page}">`));
    assert.ok(!result.body.includes("attacker.invalid"));
  }
});

test("search metadata cannot be poisoned through Host or forwarded protocol", async () => {
  for (const url of ["/robots.txt", "/sitemap.xml"]) {
    const result = await request(url, {
      headers: { Host: "attacker.invalid", "X-Forwarded-Proto": "javascript" },
    });
    assert.ok(result.body.includes(new URL(site.publicUrl).origin));
    assert.ok(!result.body.includes("attacker.invalid"));
    assert.ok(!result.body.includes("javascript"));
    assert.ok(!result.body.includes("<lastmod>"));
  }
});

test("inquiry endpoint rejects cross-site, wrong content type and oversized bodies", async () => {
  const json = { "Content-Type": "application/json" };
  assert.equal((await request("/api/inquiry", { method: "POST", body: "{}" })).status, 415);
  assert.equal(
    (
      await request("/api/inquiry", {
        method: "POST",
        headers: { ...json, Origin: "https://attacker.invalid" },
        body: "{}",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/inquiry", {
        method: "POST",
        headers: { ...json, "Sec-Fetch-Site": "cross-site" },
        body: "{}",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/inquiry", {
        method: "POST",
        headers: { ...json, "Content-Length": "21000" },
        body: "x".repeat(21000),
      })
    ).status,
    413,
  );
  assert.equal(
    (
      await request("/api/inquiry", {
        method: "POST",
        headers: json,
        chunks: [Buffer.alloc(10000, 65), Buffer.alloc(10001, 65)],
      })
    ).status,
    413,
  );
});

test("spoofed forwarded addresses cannot bypass direct-server rate limits", async () => {
  let blocked = false;
  for (let i = 0; i < 6; i++) {
    const result = await request("/api/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": `198.51.100.${i}` },
      body: "{}",
    });
    if (result.status === 429) {
      blocked = true;
      assert.equal(result.headers["retry-after"], "600");
    }
  }
  assert.ok(blocked);
});
