const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { load } = require("cheerio");
const { renderHtml, schemaFor, publicConfig } = require("../backend/render");
const config = require("../backend/data/site.json");
const render = (file, data = config) => load(renderHtml(path.join(__dirname, "../frontend", file), data));

test("public configuration allow-lists fields rather than exposing arbitrary internal data", () => {
  const data = structuredClone(config);
  data.smtpPassword = "private-test-marker";
  data.address.internalNote = "private-test-marker";
  data.services[0].internalNote = "private-test-marker";
  assert.ok(!JSON.stringify(publicConfig(data)).includes("private-test-marker"));
  assert.ok(!render("index.html", data)("#site-config").text().includes("private-test-marker"));
});

test("services, FAQ, business data and detail content exist in the initial HTML", () => {
  const home = render("index.html");
  assert.equal(home(".home-service-directory__item").length, config.services.length);
  assert.deepEqual(
    home(".home-service-directory__item strong")
      .map((_, item) => home(item).text())
      .get(),
    config.services.map((service) => service.title),
  );
  assert.equal(home(".faq-list details").length, config.faq.length);
  assert.equal(home("[data-opening-hours] li").length, config.openingHours.length);
  for (const service of config.services) {
    const page = render(`${service.slug}.html`);
    assert.equal(page("h1").text(), service.title);
    assert.equal(page("[data-service-summary]").text(), service.summary);
    assert.equal(page("[data-service-steps] li").length, service.steps.length);
    assert.equal(page(".service-hero__media").attr("fetchpriority"), "high");
    assert.match(page('main a[href*="/kontakt.html?"]').attr("href"), /service=/);
  }
  const services = render("leistungen.html");
  assert.equal(services(".service-checklist").length, 7);
  assert.equal(services(".service-card h2").length, 7);
  assert.equal(services(".service-card img").first().attr("loading"), "eager");
  assert.ok(home("[data-service-icon] svg").length > 10);
});
test("only enabled packages and active services are rendered", () => {
  for (const enabled of [false, undefined, "true"]) {
    const doc = render("preise.html", { ...config, packagesEnabled: enabled });
    assert.equal(doc(".package").length, 0);
    assert.deepEqual(JSON.parse(doc("#site-config").text()).packages, []);
  }
  const active = render("leistungen.html", {
    ...config,
    services: config.services.map((s, i) => ({ ...s, active: i !== 0 })),
  });
  assert.equal(active("#service-innenreinigung").length, 0);
});

test("enabled package section renders exactly the configured cards in server HTML", () => {
  const doc = render("preise.html");
  const cards = doc("[data-packages-grid] > .package");
  assert.equal(cards.length, config.packages.length);
  assert.deepEqual(
    cards.map((_, card) => doc(card).attr("data-package-name")).get(),
    config.packages.map((item) => item.name),
  );
  config.packages.forEach((item, index) => {
    const card = cards.eq(index);
    assert.equal(card.find("h3").text(), item.name);
    assert.equal(card.find("p").text(), item.shortDescription);
    assert.equal(card.find("li").length, item.features.length);
    assert.equal(card.find(".package__price strong").text(), item.price);
    assert.equal(card.find(".package__price small").text(), item.priceSuffix);
    assert.equal(card.find(".package__cta").text().trim(), item.cta);
    assert.equal(card.hasClass("package--featured"), item.highlighted);
    assert.equal(
      card.find(".package__cta").attr("href"),
      `/kontakt.html?paket=${encodeURIComponent(item.name)}#anfrage`,
    );
  });
  assert.ok(!doc("[data-packages-section]").is("[hidden]"));
});
test("config values cannot inject HTML or escape embedded JSON", () => {
  const attack = '</script><script src="https://evil.invalid/x.js"></script><img src=x onerror=alert(1)>';
  const doc = render("leistungen.html", {
    ...config,
    siteName: attack,
    services: config.services.map((s) => ({ ...s, title: attack, image: "javascript:alert(1)" })),
  });
  assert.equal(doc('script[src^="https:"]').length, 0);
  assert.equal(doc("[onerror]").length, 0);
  assert.equal(doc('img[src^="javascript:"]').length, 0);
  assert.equal(JSON.parse(doc("#site-config").text()).siteName, attack);
  const packages = render("preise.html", {
    ...config,
    packages: config.packages.map((item) => ({
      ...item,
      name: attack,
      shortDescription: attack,
      features: [attack],
      price: attack,
      priceSuffix: attack,
      cta: attack,
    })),
  });
  assert.equal(packages('script[src^="https:"]').length, 0);
  assert.equal(packages("[onerror]").length, 0);
});
test("central data updates legal pages, hero location and public contact data", () => {
  const fixture = {
    ...config,
    siteName: "TESTFIRMA",
    shortName: "TEST",
    phone: "+49 30 12345678",
    email: "kontakt@fixture.invalid",
    legal: {
      owner: "TESTINHABER",
      legalForm: "TESTFORM",
      register: "",
      vatId: "",
      contentResponsible: "TESTPERSON",
    },
    address: { street: "TESTSTRASSE", zip: "12345", city: "TESTORT", country: "DE" },
  };
  const home = render("index.html", fixture);
  assert.equal(home("[data-city]").text(), "TESTORT");
  const legal = render("impressum.html", fixture);
  assert.equal(legal('[data-legal="owner"]').text(), "TESTINHABER");
  assert.equal(legal('[data-legal="vatId"]').text(), "");
  assert.ok(!legal("main").text().includes("[KUNDENNAME]"));
  assert.equal(legal("[data-call-link]").first().attr("href"), "tel:+493012345678");
});
test("unconfirmed businesses emit no schema; approved data emits structured data", () => {
  assert.equal(schemaFor(config), null);
  assert.equal(render("index.html")('script[type="application/ld+json"]').length, 0);
  const ready = {
    ...config,
    indexingEnabled: true,
    siteName: "TESTFIRMA",
    phone: "+49 30 12345678",
    email: "test@fixture.de",
    address: { street: "TESTSTRASSE", zip: "12345", city: "TESTORT", country: "DE" },
  };
  const schema = JSON.parse(render("index.html", ready)('script[type="application/ld+json"]').text());
  assert.equal(schema["@type"], "AutomotiveBusiness");
  assert.equal(schema.address.addressLocality, "TESTORT");
  assert.equal(schema.openingHoursSpecification, undefined);
});
test("public pages have metadata, one H1, local scripts, no automatic maps and unique IDs", () => {
  for (const file of fs.readdirSync(path.join(__dirname, "../frontend")).filter((f) => f.endsWith(".html"))) {
    const doc = render(file);
    assert.equal(doc("h1").length, 1, file);
    assert.equal(doc('link[rel="canonical"]').length, 1, file);
    assert.equal(doc('link[rel="icon"]').length, 1, file);
    assert.equal(doc('meta[property="og:image"]').length, 1, file);
    assert.ok(doc("title").text().length > 4, file);
    const ids = doc("[id]")
      .toArray()
      .map((el) => doc(el).attr("id"));
    assert.equal(new Set(ids).size, ids.length, file);
    assert.equal(doc("[data-map-frame][src]").length, 0, file);
    assert.equal(doc('a[href^="javascript:"]').length, 0, file);
    assert.equal(doc('script[src^="https:"]').length, 0, file);
    assert.ok(doc("noscript").text().includes("no-script.css"), file);
  }
});
