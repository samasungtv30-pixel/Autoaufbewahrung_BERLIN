const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const { test } = require("node:test");

const root = path.join(__dirname, "..");
const valid = {
  name: "Testkunde",
  phone: "030123456",
  email: "test@kunde.de",
  message: "Innenraum reinigen",
  privacy: "accepted",
};

function serverHarness(deliver, env = {}) {
  let handle;
  let cleanup;
  const logs = [];
  const writes = [];
  const disk = new Proxy(fs, {
    get(target, key) {
      if (/^(write|append|createWrite|mkdir|rename)/.test(String(key))) {
        return () => {
          writes.push(key);
          throw new Error("Persistence forbidden");
        };
      }
      return target[key];
    },
  });
  const context = vm.createContext({
    __dirname: path.join(root, "backend"),
    URL,
    Buffer,
    process: { env },
    console: { log() {}, error: (...args) => logs.push(args.join(" ")) },
    setInterval: (callback) => {
      cleanup = callback;
      return { unref() {} };
    },
    require: (name) => {
      if (name === "http")
        return {
          createServer: (callback) => {
            handle = callback;
            return { listen() {} };
          },
        };
      if (name === "fs") return disk;
      if (name === "dotenv") return { config() {} };
      if (name === "./mailer") return { sendInquiryEmail: deliver };
      return require(name);
    },
  });
  vm.runInContext(fs.readFileSync(path.join(root, "backend/server.js"), "utf8"), context);
  return {
    context,
    logs,
    writes,
    cleanup: () => cleanup(),
    async request(payload, raw = false) {
      const req = new EventEmitter();
      Object.assign(req, {
        method: "POST",
        url: "/api/inquiry",
        headers: { host: "localhost", "content-type": "application/json" },
        socket: { remoteAddress: "192.0.2.10" },
        destroy() {},
      });
      const headers = {};
      let status;
      let body;
      const res = {
        setHeader: (key, value) => {
          headers[key] = value;
        },
        writeHead: (code, values) => {
          status = code;
          Object.assign(headers, values);
        },
        end: (value) => {
          body = JSON.parse(value);
        },
      };
      const pending = handle(req, res);
      if (Array.isArray(raw)) raw.forEach((chunk) => req.emit("data", chunk));
      else req.emit("data", raw ? payload : JSON.stringify(payload));
      req.emit("end");
      await pending;
      return { status, headers, body };
    },
  };
}

test("inquiries are mailed without any filesystem writes", async () => {
  let received;
  const harness = serverHarness(async (inquiry) => {
    received = inquiry;
    return { sent: true };
  });
  const result = await harness.request(valid);
  assert.equal(result.status, 200);
  assert.equal(result.body.emailSent, true);
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.equal(received.email, valid.email);
  assert.equal(received.message, valid.message);
  assert.deepEqual(harness.writes, []);
  assert.ok(!JSON.stringify(result.body).includes(valid.email));
});

test("unconfigured, rejected and failed mail never produce success", async () => {
  for (const deliver of [
    async () => ({ sent: false, reason: "not_configured" }),
    async () => ({ sent: false, reason: "delivery_failed" }),
    async () => {
      throw new Error(`SMTP rejected ${valid.email}: ${valid.message}`);
    },
  ]) {
    const harness = serverHarness(deliver);
    const result = await harness.request(valid);
    assert.equal(result.status, 503);
    assert.equal(result.body.success, false);
    assert.equal(result.body.emailSent, false);
    assert.ok(!harness.logs.join(" ").includes(valid.email));
    assert.ok(!harness.logs.join(" ").includes(valid.message));
    assert.deepEqual(harness.writes, []);
  }
});

test("invalid data and honeypot never trigger mail", async () => {
  for (const payload of [
    null,
    [],
    { ...valid, name: {} },
    { ...valid, phone: "abcde" },
    { ...valid, name: "A".repeat(91) },
    { ...valid, message: "x".repeat(1201) },
    { ...valid, message: "text\u0000text" },
    { ...valid, privacy: "" },
    { ...valid, email: "a@b.de,c@d.de" },
    { ...valid, email: "a@b.de\r\nBcc: other@d.de" },
  ]) {
    const harness = serverHarness(async () => {
      assert.fail("Unexpected delivery");
    });
    assert.equal((await harness.request(payload)).status, 400);
  }
  const harness = serverHarness(async () => {
    assert.fail("Unexpected delivery");
  });
  assert.equal((await harness.request("{broken", true)).status, 400);
  assert.equal((await harness.request({ ...valid, website: "spam" })).body.emailSent, false);
});

test("UTF-8 survives a request chunk boundary inside an umlaut", async () => {
  let received;
  const harness = serverHarness(async (inquiry) => {
    received = inquiry;
    return { sent: true };
  });
  const bytes = Buffer.from(JSON.stringify({ ...valid, message: "Grüße für die Prüfung" }));
  const boundary = bytes.indexOf(Buffer.from("ü")) + 1;
  const result = await harness.request(null, [bytes.subarray(0, boundary), bytes.subarray(boundary)]);
  assert.equal(result.status, 200);
  assert.equal(received.message, "Grüße für die Prüfung");
});

test("proxy trust counts from the right and defaults to the socket", () => {
  for (const [env, expected] of [
    [{}, "192.0.2.1"],
    [{ TRUST_PROXY_HOPS: "1" }, "198.51.100.2"],
    [{ TRUST_PROXY_HOPS: "2" }, "203.0.113.3"],
  ]) {
    const harness = serverHarness(async () => ({ sent: true }), env);
    harness.context.req = {
      headers: { "x-forwarded-for": "spoofed, 203.0.113.3, 198.51.100.2" },
      socket: { remoteAddress: "192.0.2.1" },
    };
    assert.equal(vm.runInContext("clientAddress(req)", harness.context), expected);
  }
});

test("rate limiting keeps only expiring pseudonymous counters", async () => {
  const harness = serverHarness(async () => ({ sent: true }));
  for (let i = 0; i < 5; i++) assert.equal((await harness.request(valid)).status, 200);
  assert.equal((await harness.request(valid)).status, 429);
  const keys = vm.runInContext("Array.from(inquiryAttempts.keys())", harness.context);
  assert.equal(keys.length, 1);
  assert.match(keys[0], /^[a-f0-9]{64}$/);
  vm.runInContext(
    "for (const [key] of inquiryAttempts) inquiryAttempts.set(key, [Date.now() - RATE_LIMIT_WINDOW - 1])",
    harness.context,
  );
  harness.cleanup();
  assert.equal(vm.runInContext("inquiryAttempts.size", harness.context), 0);
});

function mailHarness(env, result = { accepted: ["inhaber@betrieb.de"] }) {
  const calls = [];
  const context = vm.createContext({
    module: { exports: {} },
    process: { env },
    AbortSignal,
    require: () => ({
      createTransport: (options) => ({
        sendMail: async (message) => {
          calls.push({ options, message });
          return result;
        },
      }),
    }),
    fetch: async (url, options) => {
      calls.push({ url, options });
      return result;
    },
  });
  vm.runInContext(fs.readFileSync(path.join(root, "backend/mailer.js"), "utf8"), context);
  return { send: context.module.exports.sendInquiryEmail, calls };
}
const mailEnv = {
  SMTP_HOST: "smtp.betrieb.de",
  SMTP_USER: "user",
  SMTP_PASS: "secret",
  MAIL_FROM_EMAIL: "website@betrieb.de",
  INQUIRY_RECIPIENT: "inhaber@betrieb.de",
};
const mailData = {
  ...valid,
  id: "test-inquiry-id",
  createdAt: "2026-08-31T09:00:00Z",
  service: "Innenraum",
  message: "<script>alert(1)</script>",
};
const config = { siteName: "Testbetrieb", email: "fallback@betrieb.de" };

test("SMTP delivers only to the owner, safely escapes HTML and sets Reply-To", async () => {
  const harness = mailHarness(mailEnv);
  assert.equal((await harness.send(mailData, config)).sent, true);
  const { options, message } = harness.calls[0];
  assert.equal(message.to, mailEnv.INQUIRY_RECIPIENT);
  assert.equal(message.replyTo, valid.email);
  assert.equal(message.from.address, mailEnv.MAIL_FROM_EMAIL);
  assert.ok(message.html.includes("&lt;script&gt;"));
  assert.ok(!message.html.includes("<script>"));
  assert.equal(options.requireTLS, true);
  assert.equal(options.logger, false);
  assert.equal(options.socketTimeout, 15000);
  const rejected = mailHarness(mailEnv, { accepted: [], rejected: [mailEnv.INQUIRY_RECIPIENT] });
  assert.equal((await rejected.send(mailData, config)).sent, false);
});

test("missing configuration and placeholder recipients cannot send", async () => {
  for (const env of [
    {},
    { ...mailEnv, INQUIRY_RECIPIENT: "kontakt@kundenname.example" },
    { ...mailEnv, MAIL_FROM_EMAIL: "website@example.de" },
    { ...mailEnv, MAIL_TRANSPORT: "unknown" },
  ]) {
    const harness = mailHarness(env);
    assert.equal((await harness.send(mailData, config)).reason, "not_configured");
    assert.equal(harness.calls.length, 0);
  }
});

test("HTTPS email transport validates provider acceptance and uses fixed recipient", async () => {
  const env = { ...mailEnv, MAIL_TRANSPORT: "resend", RESEND_API_KEY: "test-secret" };
  const harness = mailHarness(env, { ok: true, json: async () => ({ id: "provider-id" }) });
  assert.equal((await harness.send(mailData, config)).sent, true);
  assert.equal(harness.calls[0].url, "https://api.resend.com/emails");
  const { options } = harness.calls[0];
  const body = JSON.parse(options.body);
  assert.deepEqual(body.to, [mailEnv.INQUIRY_RECIPIENT]);
  assert.equal(body.reply_to, valid.email);
  assert.equal(options.headers["Idempotency-Key"], mailData.id);
  for (const response of [{ ok: false }, { ok: true, json: async () => ({}) }]) {
    assert.equal((await mailHarness(env, response).send(mailData, config)).sent, false);
  }
});

test("a failed decorative icon cannot block form initialization", async () => {
  const calls = [];
  const context = vm.createContext({
    console,
    document: { addEventListener() {}, querySelectorAll: () => [{ dataset: { serviceIcon: "phone" } }] },
    fetch: async () => {
      throw new Error("Icon unavailable");
    },
  });
  vm.runInContext(fs.readFileSync(path.join(root, "frontend/js/main.js"), "utf8"), context);
  await context.hydrateServiceIcons();
  for (const name of [
    "initStickyActions",
    "initNav",
    "initMotion",
    "loadConfig",
    "renderServicePage",
    "applyGlobalConfig",
    "renderServices",
    "renderPackages",
    "initServiceTimelines",
    "renderIndividualServices",
    "renderReviews",
    "renderFaq",
    "renderOpeningHours",
    "initContactMap",
    "initInquiryForm",
    "initServiceDeepLinks",
    "hydrateServiceIcons",
  ]) {
    context[name] = () => {
      calls.push(name);
    };
  }
  await context.init();
  assert.ok(calls.indexOf("initInquiryForm") < calls.indexOf("hydrateServiceIcons"));
  assert.ok(calls.indexOf("renderServicePage") < calls.indexOf("applyGlobalConfig"));
});

test("form resets only after confirmed mail acceptance; failures preserve input", async () => {
  for (const response of [
    { ok: true, body: { success: true, emailSent: true }, resets: 1 },
    { ok: false, body: { success: false, error: "Versand fehlgeschlagen" }, resets: 0 },
    { ok: true, body: { success: true, emailSent: false, emailStatus: "not_configured" }, resets: 0 },
    { networkError: true, resets: 0 },
  ]) {
    let submit;
    let resetCount = 0;
    const button = {};
    const status = { classList: { toggle() {} } };
    const form = {
      querySelector: (selector) => (selector === 'button[type="submit"]' ? button : {}),
      addEventListener: (_, callback) => {
        submit = callback;
      },
      setAttribute() {},
      removeAttribute() {},
      reset: () => {
        resetCount++;
      },
    };
    const context = vm.createContext({
      URLSearchParams,
      console,
      AbortSignal,
      document: {
        addEventListener() {},
        querySelector: (selector) => (selector === "#inquiry-form" ? form : status),
      },
      window: { location: { search: "" } },
      FormData: class {
        entries() {
          return Object.entries(valid);
        }
      },
      fetch: async () => {
        if (response.networkError) throw new Error("Network unavailable");
        return { ok: response.ok, json: async () => response.body };
      },
    });
    vm.runInContext(fs.readFileSync(path.join(root, "frontend/js/main.js"), "utf8"), context);
    vm.runInContext("siteConfig = { services: [], packagesConfirmed: false }; initInquiryForm();", context);
    await submit({ preventDefault() {} });
    assert.equal(resetCount, response.resets);
    assert.equal(button.disabled, false);
    if (!response.resets) assert.ok(!status.textContent.includes("Vielen Dank"));
  }
});
