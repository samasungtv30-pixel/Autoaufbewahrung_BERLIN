const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const business = require("../frontend/js/business");
const source = fs.readFileSync(path.join(__dirname, "../frontend/js/main.js"), "utf8");

test("scroll and resize updates are coalesced into one animation frame", () => {
  const listeners = new Map();
  const frames = [];
  const states = [];
  const bar = { style: {} };
  const header = { classList: { toggle: (name, value) => states.push([name, value]) } };
  const context = vm.createContext({
    document: {
      addEventListener() {},
      querySelector: (selector) => (selector === ".site-header" ? header : bar),
      querySelectorAll: () => [],
      createElement: () => ({ setAttribute() {}, querySelector: () => bar }),
      body: { append() {} },
      documentElement: { scrollHeight: 2000 },
    },
    window: {
      scrollY: 0,
      innerHeight: 1000,
      matchMedia: () => ({ matches: true }),
      addEventListener: (name, callback) => listeners.set(name, callback),
      requestAnimationFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      },
    },
  });
  vm.runInContext(source, context);
  context.initMotion();
  assert.equal(bar.style.transform, "scaleX(0)");
  context.window.scrollY = 400;
  for (let i = 0; i < 20; i++) listeners.get("scroll")();
  listeners.get("resize")();
  assert.equal(frames.length, 1);
  frames[0]();
  assert.equal(bar.style.transform, "scaleX(0.4)");
  assert.deepEqual(states.at(-1), ["is-scrolled", true]);
  context.window.scrollY = 0;
  listeners.get("scroll")();
  assert.equal(frames.length, 2);
  frames[1]();
  assert.equal(bar.style.transform, "scaleX(0)");
});

test("sticky contacts preserve server markup and are inert while a field is edited", () => {
  const listeners = new Map();
  const states = new Map();
  const sticky = { classList: { toggle: (name, value) => states.set(name, value) } };
  Object.defineProperty(sticky, "innerHTML", {
    set() {
      throw new Error("Must preserve SSR contacts");
    },
  });
  const document = {
    addEventListener: (name, callback) => listeners.set(name, callback),
    querySelector: () => sticky,
    activeElement: { matches: () => false },
    body: { classList: { contains: () => false } },
  };
  const context = vm.createContext({ document, window: { setTimeout: (callback) => callback() } });
  vm.runInContext(source, context);
  context.initStickyActions();
  assert.equal(sticky.inert, false);
  document.activeElement.matches = () => true;
  listeners.get("focusin")();
  assert.equal(sticky.inert, true);
  assert.equal(states.get("is-suppressed"), true);
  document.activeElement.matches = () => false;
  listeners.get("focusout")();
  assert.equal(sticky.inert, false);
  assert.equal(states.get("is-suppressed"), false);
  document.body.classList.contains = () => true;
  listeners.get("focusin")();
  assert.equal(sticky.inert, true);
});

function formHarness() {
  let submit, input, resolveRequest;
  let requests = 0,
    resets = 0;
  const button = {};
  const status = { classList: { toggle() {} } };
  const attributes = new Map();
  const resultNodes = Object.fromEntries(
    ["title", "copy", "success", "error", "alternative", "close"].map((name) => [
      `[data-result-${name}]`,
      { addEventListener() {} },
    ]),
  );
  const dialog = {
    classList: { toggle() {} },
    addEventListener() {},
    querySelector: (selector) => resultNodes[selector],
    showModal() {
      this.open = true;
    },
  };
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
      querySelector: (selector) =>
        ({
          "#inquiry-form": form,
          "[data-form-status]": status,
          "[data-inquiry-result]": dialog,
        })[selector] || null,
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
    dialog,
    resultNodes,
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

test("mail result dialog confirms accepted mail and retains inputs on failures", async () => {
  for (const outcome of ["success", "provider-error", "filtered", "invalid-json"]) {
    const h = formHarness();
    const pending = h.submit();
    assert.equal(h.dialog.open, undefined);
    h.resolve({
      ok: outcome !== "provider-error",
      json: async () =>
        outcome === "invalid-json"
          ? null
          : {
              success: outcome !== "provider-error",
              emailSent: outcome === "success",
            },
    });
    await pending;
    assert.equal(h.dialog.open, true);
    assert.equal(h.resets(), outcome === "success" ? 1 : 0);
    assert.equal(h.resultNodes["[data-result-alternative]"].hidden, outcome === "success");
    assert.match(
      h.resultNodes["[data-result-title]"].textContent,
      outcome === "success" ? /Vielen Dank/ : /nicht bestätigt/,
    );
  }
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

test("premium motion respects reduced motion before creating observers", () => {
  const classes = [];
  let observers = 0;
  const context = vm.createContext({
    document: {
      addEventListener() {},
      body: { classList: { add: (name) => classes.push(name) } },
      querySelectorAll: () => [],
    },
    window: { matchMedia: () => ({ matches: true }) },
    IntersectionObserver: class {
      constructor() {
        observers++;
      }
    },
  });
  vm.runInContext(source, context);
  context.initPremiumMotion();
  assert.deepEqual(classes, ["motion-reduced"]);
  assert.equal(observers, 0);
});

test("image reveal observes a visible parent instead of the closed clip mask", () => {
  const observerCallbacks = [];
  const shellClasses = [];
  const parent = { contains: (element) => element === shell };
  const shell = { parentElement: parent, classList: { add: (name) => shellClasses.push(name) } };
  class Observer {
    constructor(callback) {
      observerCallbacks.push(callback);
    }
    observe() {}
    unobserve() {}
  }
  const context = vm.createContext({
    document: {
      addEventListener() {},
      body: { classList: { add() {} } },
      querySelector: () => null,
      querySelectorAll: (selector) => (selector.includes("home-service-card__media") ? [shell] : []),
    },
    window: {
      scrollY: 0,
      addEventListener() {},
      requestAnimationFrame() {},
      matchMedia: () => ({ matches: false }),
      IntersectionObserver: Observer,
    },
    IntersectionObserver: Observer,
  });
  vm.runInContext(source, context);
  context.initPremiumMotion();
  observerCallbacks[0]([{ isIntersecting: true, target: parent }]);
  assert.ok(shellClasses.includes("motion-image-reveal"));
  assert.ok(shellClasses.includes("is-revealed"));
});
