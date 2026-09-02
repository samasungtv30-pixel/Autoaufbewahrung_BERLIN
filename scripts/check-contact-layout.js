const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.join(__dirname, "..");

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
      const timeout = setTimeout(() => reject(new Error("Contact test server timeout")), 10000);
      const fail = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
      server.once("error", fail);
      server.once("exit", () => fail(new Error("Contact test server exited")));
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
    const pages = fs.readdirSync(path.join(root, "frontend")).filter((file) => file.endsWith(".html"));
    for (const width of [320, 360, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      for (const file of pages) {
        await page.goto(`http://localhost:${port}/${file}`);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator(".mobile-sticky-actions").count(), 1);
        await page.evaluate(() =>
          scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
        );
        await page.waitForTimeout(100);
        const layout = await page.evaluate(() => {
          const bar = document.querySelector(".mobile-sticky-actions").getBoundingClientRect();
          const content = document.querySelector(".site-footer") || document.querySelector("main");
          return {
            contentBottom: content.getBoundingClientRect().bottom,
            barTop: bar.top,
            height: bar.height,
            overflow: document.documentElement.scrollWidth > innerWidth,
            targets: [...document.querySelectorAll(".mobile-sticky-actions a")].map(
              (e) => e.getBoundingClientRect().height,
            ),
          };
        });
        assert.equal(layout.overflow, false, `${width} ${file}: horizontal overflow`);
        assert.equal(layout.height, 60, `${width} ${file}: contact bar height`);
        assert.ok(layout.targets.every((height) => height >= 48));
        assert.ok(layout.contentBottom <= layout.barTop + 1, `${width} ${file}: content behind contact bar`);
        if (file === "kontakt.html") {
          await page.locator('[name="phone"]').focus();
          assert.equal(await page.locator(".mobile-sticky-actions").evaluate((e) => e.inert), true);
          await page.locator('[name="phone"]').blur();
          await page.waitForTimeout(50);
          assert.equal(await page.locator(".mobile-sticky-actions").evaluate((e) => e.inert), false);
        }
      }
      console.log(`Contact layout: ${pages.length} pages passed at ${width}px`);
    }
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const plain = await context.newPage();
    await plain.goto(`http://localhost:${port}/kontakt.html`);
    assert.equal(await plain.locator(".mobile-sticky-actions").isVisible(), true);
    assert.equal(await plain.locator(".mobile-sticky-actions svg").count(), 2);
    assert.equal(await plain.locator("[data-map-frame]").getAttribute("src"), null);
    await context.close();
    console.log("Contact bar and map consent passed without JavaScript.");
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
