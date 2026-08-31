const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "backend/data/site.json"), "utf8"));
const elements = new Map();
const classes = new Set(["home"]);
const listeners = new Map();
const context = vm.createContext({
  console,
  URLSearchParams,
  URL,
  document: {
    addEventListener() {},
    body: { classList: { contains: (name) => classes.has(name) } },
    querySelector: (selector) => elements.get(selector) || null,
    getElementById: (id) => elements.get(`#${id}`) || null,
  },
  window: {
    location: { hash: "" },
    addEventListener: (name, callback) => listeners.set(name, callback),
  },
});
vm.runInContext(fs.readFileSync(path.join(root, "frontend/js/main.js"), "utf8"), context);
context.configFixture = config;
vm.runInContext("siteConfig = configFixture", context);

const grid = {
  dataset: {
    servicesVariant: "home-teaser",
    servicesSlugs: "innenreinigung,lackaufbereitung,komplettaufbereitung",
  },
  innerHTML: "",
};
elements.set("[data-services-grid]", grid);
context.renderServices();
assert.equal((grid.innerHTML.match(/class="home-service-card__details"/g) || []).length, 3);
for (const slug of grid.dataset.servicesSlugs.split(",")) {
  assert.ok(grid.innerHTML.includes(`href="/leistungen.html#service-${slug}"`));
}

classes.clear();
classes.add("services-page");
grid.dataset = {};
context.renderServices();
assert.equal(
  (grid.innerHTML.match(/class="service-checklist"/g) || []).length,
  config.services.filter((service) => service.active !== false).length,
);
assert.ok(!grid.innerHTML.includes("service-card__timeline"));

const packageGrid = { innerHTML: "" };
const packageSection = { hidden: true };
elements.set("[data-packages-grid]", packageGrid);
elements.set("[data-packages-section]", packageSection);
context.renderPackages();
assert.equal(packageGrid.innerHTML, "");
assert.equal(packageSection.hidden, true);
context.configFixture = { ...config, packagesConfirmed: true };
vm.runInContext("siteConfig = configFixture", context);
context.renderPackages();
assert.equal(packageSection.hidden, false);
assert.equal((packageGrid.innerHTML.match(/class="package package--/g) || []).length, config.packages.length);
assert.equal(
  (packageGrid.innerHTML.match(/data-service-icon="circle-check-big"/g) || []).length,
  config.packages.reduce((sum, item) => sum + item.features.length, 0),
);
for (const item of config.packages) {
  assert.ok(
    packageGrid.innerHTML.includes(`href="/kontakt.html?paket=${encodeURIComponent(item.name)}#anfrage"`),
  );
}

const messageField = { value: "" };
const serviceSelect = {};
elements.set("[data-form-status]", {});
elements.set("#inquiry-form", {
  querySelector: (selector) =>
    selector === "#service" ? serviceSelect : selector === '[name="message"]' ? messageField : null,
  addEventListener() {},
});
context.window.location.search = "?paket=Premium";
context.initInquiryForm();
assert.equal(messageField.value, "Ich interessiere mich für das Pflegepaket Premium.");
messageField.value = "Meine eigene Nachricht";
context.initInquiryForm();
assert.equal(messageField.value, "Meine eigene Nachricht");
messageField.value = "";
context.window.location.search = "?paket=unknown";
context.initInquiryForm();
assert.equal(messageField.value, "");

// Only an explicit business approval may publish packages or prefill inquiries.
for (const approval of [false, undefined, "true"]) {
  context.configFixture = { ...config, packagesConfirmed: approval };
  vm.runInContext("siteConfig = configFixture", context);
  context.renderPackages();
  assert.equal(packageGrid.innerHTML, "");
  assert.equal(packageSection.hidden, true);
  context.window.location.search = "?paket=Premium";
  context.initInquiryForm();
  assert.equal(messageField.value, "");
}

const calls = [];
elements.set("#service-lackaufbereitung", {
  classList: { contains: (name) => name === "service-card--premium" },
  setAttribute: (name, value) => calls.push([name, value]),
  scrollIntoView: (options) => calls.push(["scroll", options.block]),
  focus: (options) => calls.push(["focus", options.preventScroll]),
});
context.window.location.hash = "#service-lackaufbereitung";
context.initServiceDeepLinks();
assert.deepEqual(calls, [
  ["tabindex", "-1"],
  ["scroll", "start"],
  ["focus", true],
]);
assert.ok(listeners.has("hashchange"));
context.window.location.hash = "#unknown-service";
listeners.get("hashchange")();
assert.equal(calls.length, 3);

// Missing customer data must not produce a live map.
const mapButton = { disabled: false, textContent: "Karte laden" };
const frame = {};
for (const selector of [".contact-map-shell", "[data-map-consent]"]) elements.set(selector, {});
elements.set("[data-map-frame]", frame);
elements.set("[data-map-load]", mapButton);
elements.set("[data-map-copy]", {});
context.configFixture = { ...config, address: { street: "[Adresse]", zip: "[PLZ]", city: "[Ort]" } };
vm.runInContext("siteConfig = configFixture", context);
context.initContactMap();
assert.equal(mapButton.disabled, true);
assert.equal(frame.src, undefined);

let loadMap;
let loadedClass;
elements.set(".contact-map-shell", {
  classList: {
    add: (name) => {
      loadedClass = name;
    },
  },
});
elements.set("[data-map-load]", {
  addEventListener: (name, callback) => {
    assert.equal(name, "click");
    loadMap = callback;
  },
});
context.configFixture = { ...config, address: { street: "Teststrasse 1", zip: "12345", city: "Teststadt" } };
vm.runInContext("siteConfig = configFixture", context);
context.initContactMap();
assert.equal(frame.src, undefined);
loadMap();
assert.equal(frame.src, "https://www.google.com/maps?q=Teststrasse%201%2C%2012345%20Teststadt&output=embed");
assert.equal(frame.hidden, false);
assert.equal(elements.get("[data-map-consent]").hidden, true);
assert.equal(loadedClass, "is-loaded");

assert.equal(context.hasUsableWhatsapp("https://wa.me/493012345678"), true);
for (const value of [
  "javascript:alert(493012345678)",
  "https://attacker.invalid/493012345678",
  "https://wa.me/4900000000000",
  "http://wa.me/493012345678",
]) {
  assert.equal(context.hasUsableWhatsapp(value), false);
}

console.log(
  "UI checks passed: service links, checklists, package inquiries, deep links and map availability.",
);
