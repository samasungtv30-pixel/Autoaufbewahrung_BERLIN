const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.join(__dirname, "..");
const pages = fs
  .readdirSync(path.join(root, "frontend"))
  .filter((name) => name.endsWith(".html") && name !== "404.html")
  .map((name) => (name === "index.html" ? "/" : `/${name}`));
const selectors = [
  ".site-header",
  ".site-header .nav",
  ".site-header .brand-logo",
  ".site-header .nav-actions",
  ".site-header .nav-toggle",
  ...Array.from({ length: 5 }, (_, i) => `.nav-links > a:nth-child(${i + 1})`),
];

async function geometry(page) {
  return page.evaluate(
    (selectors) =>
      Object.fromEntries(
        selectors.map((selector) => {
          const element = document.querySelector(selector);
          const rect = element.getBoundingClientRect();
          return [
            selector,
            {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              visible: getComputedStyle(element).display !== "none",
            },
          ];
        }),
      ),
    selectors,
  );
}
function equalGeometry(actual, expected, label) {
  for (const selector of selectors) {
    if (!expected[selector].visible) continue;
    for (const key of ["x", "y", "width", "height"])
      assert.ok(
        Math.abs(actual[selector][key] - expected[selector][key]) < 1,
        `${label}: ${selector} ${key}`,
      );
  }
}

async function main() {
  let browser;
  const server = spawn(process.execPath, ["backend/server.js"], {
    cwd: root,
    env: { ...process.env, PORT: "0", MAIL_TRANSPORT: "disabled" },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Header test server timeout")), 10000);
      server.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      server.once("exit", () => {
        clearTimeout(timeout);
        reject(new Error("Header test server exited"));
      });
      server.stdout.on("data", (data) => {
        const match = String(data).match(/localhost:(\d+)/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[1]);
        }
      });
    });
    browser = await chromium.launch({
      headless: true,
      ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
    });
    const page = await browser.newPage({ reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of [768, 1024, 1051, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      let reference;
      for (const route of pages) {
        await page.goto(`http://localhost:${port}${route}`);
        await page.evaluate(() => document.fonts.ready);
        const before = await geometry(page);
        if (reference) equalGeometry(before, reference, `${width} ${route}`);
        else reference = before;
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.evaluate(() => scrollTo({ top: 300, behavior: "instant" }));
        await page.waitForTimeout(50);
        equalGeometry(await geometry(page), before, `${width} ${route} scrolled`);
      }
      if (width <= 1050) {
        const before = await geometry(page);
        await page.locator(".nav-toggle").click();
        const after = await geometry(page);
        assert.equal(after[".site-header"].y, before[".site-header"].y);
        await page.keyboard.press("Escape");
      }
      console.log(`Header: ${pages.length} pages consistent at ${width}px`);
    }
    for (const width of [768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const slow = await context.newPage();
      await slow.route("**/*.woff2", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
      });
      await slow.goto(`http://localhost:${port}/pakete.html`, { waitUntil: "domcontentloaded" });
      const before = await geometry(slow);
      await slow.evaluate(() => document.fonts.ready);
      await slow.waitForTimeout(800);
      equalGeometry(await geometry(slow), before, `${width} delayed fonts`);
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log("Header regression checks passed, including delayed fonts and tablet menu.");
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null) {
      const exited = once(server, "exit");
      server.kill();
      await exited;
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
