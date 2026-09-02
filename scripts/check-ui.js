const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const business = require("../frontend/js/business");
const config = require("../backend/data/site.json");
const elements = new Map();
const listeners = new Map();
const context = vm.createContext({
  console,
  URLSearchParams,
  URL,
  document: {
    addEventListener() {},
    body: { classList: { contains: (name) => name === "services-page" } },
    querySelector: (selector) => elements.get(selector) || null,
    getElementById: (id) => elements.get(`#${id}`) || null,
  },
  window: {
    AutoBusiness: business,
    location: { hash: "", search: "" },
    addEventListener: (name, callback) => listeners.set(name, callback),
    setTimeout: (callback) => {
      context.timeoutCallback = callback;
      return 1;
    },
    clearTimeout() {},
  },
});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../frontend/js/main.js"), "utf8"), context);
function fixture(value) {
  context.configFixture = value;
  vm.runInContext("siteConfig = configFixture", context);
}
fixture(config);
const messageField = { value: "" };
const serviceSelect = {};
elements.set("[data-form-status]", {});
elements.set("#inquiry-form", {
  querySelector: (selector) =>
    selector === "#service" ? serviceSelect : selector === '[name="message"]' ? messageField : null,
  addEventListener() {},
});
fixture({ ...config, packagesEnabled: true });
for (const item of config.packages) {
  messageField.value = "";
  context.window.location.search = `?paket=${encodeURIComponent(item.name)}`;
  context.initInquiryForm();
  assert.equal(messageField.value, `Ich interessiere mich für das Pflegepaket ${item.name}.`);
}
messageField.value = "";
context.window.location.search = "?paket=Unbekannt";
context.initInquiryForm();
assert.equal(messageField.value, "");
context.window.location.search = "?paket=Premium";
messageField.value = "Meine eigene Nachricht";
context.initInquiryForm();
assert.equal(messageField.value, "Meine eigene Nachricht");
for (const approval of [false, undefined, "true"]) {
  messageField.value = "";
  fixture({ ...config, packagesEnabled: approval });
  context.initInquiryForm();
  assert.equal(messageField.value, "");
}
fixture(config);
for (const service of config.services) {
  for (const value of [service.slug, service.title]) {
    serviceSelect.value = "";
    context.window.location.search = `?service=${encodeURIComponent(value)}`;
    context.initInquiryForm();
    assert.equal(serviceSelect.value, service.title);
  }
}
for (const value of ["Unbekannt", "<img src=x onerror=alert(1)>", "../innenreinigung"]) {
  serviceSelect.value = "";
  messageField.value = "";
  context.window.location.search = `?service=${encodeURIComponent(value)}&paket=${encodeURIComponent(value)}`;
  context.initInquiryForm();
  assert.equal(serviceSelect.value, "");
  assert.equal(messageField.value, "");
}
fixture({ ...config, services: config.services.map((service) => ({ ...service, active: false })) });
serviceSelect.value = "";
context.window.location.search = `?service=${config.services[0].slug}`;
context.initInquiryForm();
assert.equal(serviceSelect.value, "");
fixture(config);
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
context.window.location.hash = "#unknown-service";
listeners.get("hashchange")();
assert.equal(calls.length, 3);

function mapFixture(address) {
  let click;
  const events = new Map();
  const frame = {
    hidden: true,
    addEventListener: (name, cb) => events.set(name, cb),
    removeEventListener: (name) => events.delete(name),
    removeAttribute: (name) => {
      delete frame[name];
    },
  };
  const button = {
    addEventListener: (_, cb) => {
      click = cb;
    },
  };
  const consent = { hidden: false };
  const copy = {};
  const shell = { classList: { add() {} }, setAttribute() {}, removeAttribute() {} };
  for (const [selector, element] of [
    [".contact-map-shell", shell],
    ["[data-map-consent]", consent],
    ["[data-map-frame]", frame],
    ["[data-map-load]", button],
    ["[data-map-copy]", copy],
  ])
    elements.set(selector, element);
  fixture({ ...config, address });
  context.initContactMap();
  return { frame, button, consent, copy, events, click: () => click() };
}
const missing = mapFixture(config.address);
assert.equal(missing.button.disabled, true);
assert.equal(missing.frame.src, undefined);
const map = mapFixture({ street: "Teststraße 1", zip: "12345", city: "Teststadt" });
assert.equal(map.frame.src, undefined);
map.click();
assert.match(map.frame.src, /^https:\/\/www.google.com\/maps\?q=/);
assert.equal(map.button.disabled, true);
assert.equal(map.consent.hidden, false);
map.events.get("load")();
assert.equal(map.consent.hidden, true);
const failure = mapFixture({ latitude: 52, longitude: 13 });
failure.click();
assert.match(failure.frame.src, /q=52%2C13/);
context.timeoutCallback();
assert.equal(failure.frame.src, undefined);
assert.equal(failure.frame.hidden, true);
assert.equal(failure.button.disabled, false);
assert.match(failure.copy.textContent, /nicht geladen/);
failure.click();
failure.events.get("error")();
assert.equal(failure.button.textContent, "Erneut versuchen");
assert.equal(failure.consent.hidden, false);

assert.equal(business.hasUsableWhatsapp("https://wa.me/493012345678"), true);
for (const value of [
  "javascript:alert(493012345678)",
  "https://attacker.invalid/493012345678",
  "https://wa.me/4900000000000",
  "http://wa.me/493012345678",
])
  assert.equal(business.hasUsableWhatsapp(value), false);
assert.equal(
  new URL(business.whatsappUrl("https://wa.me/493012345678?text=old", "Felgen & Lack? ü")).searchParams.get(
    "text",
  ),
  "Felgen & Lack? ü",
);
assert.equal(business.coordinates({ latitude: null, longitude: null }), "");
assert.equal(business.coordinates({ latitude: 91, longitude: 0 }), "");
console.log(
  "UI checks passed: package/service prefill, deep links, shared contact links, map consent/loading/failure/retry.",
);
