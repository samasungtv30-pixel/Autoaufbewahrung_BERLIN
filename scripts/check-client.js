const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const business = require("../frontend/js/business");
const source = fs.readFileSync(path.join(__dirname, "../frontend/js/main.js"), "utf8");

function formHarness() {
  let submit, input, resolveRequest;
  let requests = 0,
    resets = 0;
  const button = {};
  const status = { classList: { toggle() {} } };
  const attributes = new Map();
  const phone = {
    value: "030 123456",
    validity: "",
    addEventListener: (_, callback) => {
      input = callback;
    },
    setCustomValidity(value) {
      this.validity = value;
    },
    reportValidity() {},
  };
  const form = {
    querySelector: (selector) =>
      ({ "#service": { options: [1] }, '[name="phone"]': phone, 'button[type="submit"]': button })[
        selector
      ] || null,
    addEventListener: (_, callback) => {
      submit = callback;
    },
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
    reset: () => {
      resets++;
    },
  };
  const context = vm.createContext({
    AbortSignal,
    URLSearchParams,
    document: {
      addEventListener() {},
      querySelector: (selector) => (selector === "#inquiry-form" ? form : status),
    },
    window: { AutoBusiness: business, location: { search: "" } },
    FormData: class {
      entries() {
        return [
          ["name", "QA Test"],
          ["phone", phone.value],
        ];
      }
    },
    fetch: () => {
      requests++;
      return new Promise((resolve) => {
        resolveRequest = resolve;
      });
    },
  });
  vm.runInContext(source, context);
  vm.runInContext("siteConfig = { services: [] }; initInquiryForm();", context);
  return {
    phone,
    button,
    status,
    attributes,
    submit: () => submit({ preventDefault() {} }),
    input: () => input(),
    requests: () => requests,
    resets: () => resets,
    resolve: (value) => resolveRequest(value),
  };
}

test("pending submissions disable the button and cannot be duplicated", async () => {
  const h = formHarness();
  const pending = h.submit();
  await h.submit();
  assert.equal(h.requests(), 1);
  assert.equal(h.button.disabled, true);
  assert.equal(h.attributes.get("aria-busy"), "true");
  assert.match(h.status.textContent, /gesendet/);
  h.resolve({ ok: false, json: async () => ({ error: "Nicht gesendet" }) });
  await pending;
  assert.equal(h.button.disabled, false);
  assert.equal(h.resets(), 0);
  assert.equal(h.attributes.has("aria-busy"), false);
});

test("client phone validation blocks letters but allows common phone notation", async () => {
  const h = formHarness();
  h.phone.value = "abcde";
  await h.submit();
  assert.equal(h.requests(), 0);
  assert.match(h.phone.validity, /Telefonnummer/);
  h.phone.value = "+49 (30) 123-456";
  h.input();
  assert.equal(h.phone.validity, "");
  const pending = h.submit();
  h.resolve({ ok: true, json: async () => ({ success: true, emailSent: true }) });
  await pending;
  assert.equal(h.resets(), 1);
});

test("failed images receive one fallback, never a retry loop", () => {
  let error;
  class Image {
    constructor() {
      this.dataset = {};
      this.complete = true;
      this.naturalWidth = 0;
      this.src = "/images/missing.webp";
    }
    removeAttribute(name) {
      this.removed = name;
    }
  }
  const image = new Image();
  const context = vm.createContext({
    HTMLImageElement: Image,
    document: {
      addEventListener: (name, cb) => {
        if (name === "error") error = cb;
      },
      querySelectorAll: () => [image],
    },
  });
  vm.runInContext(source, context);
  context.initImageFallbacks();
  assert.equal(image.src, "/images/premium-hero.webp");
  assert.equal(image.removed, "srcset");
  image.src = "/images/failed-fallback.webp";
  error({ target: image });
  assert.equal(image.src, "/images/failed-fallback.webp");
  error({ target: {} });
});

test("mobile navigation confines focus and Escape restores the toggle", () => {
  const handlers = new Map();
  let document;
  const element = () => {
    const attrs = new Map(),
      classes = new Set(),
      events = new Map();
    return {
      events,
      setAttribute: (k, v) => attrs.set(k, v),
      getAttribute: (k) => attrs.get(k),
      removeAttribute: (k) => attrs.delete(k),
      addEventListener: (k, v) => events.set(k, v),
      classList: {
        add: (k) => classes.add(k),
        remove: (k) => classes.delete(k),
        contains: (k) => classes.has(k),
      },
      focus() {
        document.activeElement = this;
      },
    };
  };
  const toggle = element(),
    panel = element(),
    main = element(),
    footer = element(),
    sticky = element();
  const links = Array.from({ length: 5 }, element);
  panel.insertAdjacentHTML = () => {};
  panel.querySelectorAll = () => links;
  document = {
    body: { classList: element().classList, append() {} },
    activeElement: null,
    querySelector: (selector) => (selector === ".nav-toggle" ? toggle : panel),
    querySelectorAll: () => [main, footer, sticky],
    createElement: element,
    addEventListener: (name, callback) => handlers.set(name, callback),
  };
  let focusCallback;
  const context = vm.createContext({
    document,
    window: {
      location: { pathname: "/" },
      clearTimeout() {},
      setTimeout: (callback) => {
        focusCallback = callback;
      },
      matchMedia: () => ({ addEventListener() {} }),
    },
  });
  vm.runInContext(source, context);
  context.initNav();
  toggle.events.get("click")();
  focusCallback();
  assert.equal(document.activeElement, links[0]);
  assert.equal(main.inert, true);
  let prevented = false;
  links.at(-1).focus();
  handlers.get("keydown")({
    key: "Tab",
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(document.activeElement, toggle);
  handlers.get("keydown")({ key: "Tab", shiftKey: true, preventDefault() {} });
  assert.equal(document.activeElement, links.at(-1));
  handlers.get("keydown")({ key: "Escape" });
  assert.equal(document.activeElement, toggle);
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(main.inert, false);
});
