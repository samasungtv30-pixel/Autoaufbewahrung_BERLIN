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
  assert.equal(home(".service-card--premium").length, config.services.length);
  assert.equal(home(".header-utility").length, 1);
  assert.equal(home(".site-header .nav-phone").length, 1);
  assert.equal(home(".site-header .nav-whatsapp").length, 1);
  assert.equal(home(".site-header .nav-quote").length, 0);
  assert.deepEqual(
    home(".service-card--premium h3")
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
test("hero principles preserve their copy and render three decorative icons in server HTML", () => {
  const doc = render("index.html");
  assert.deepEqual(
    doc(".hero-proof strong")
      .map((_, el) => doc(el).text())
      .get(),
    ["Persönlich", "Einfach", "Transparent"],
  );
  assert.deepEqual(
    doc(".hero-proof__copy")
      .map((_, el) => doc(el).text())
      .get(),
    ["Direkte Abstimmung", "Fotos per WhatsApp", "Angebot vor Beginn"],
  );
  assert.equal(doc('.hero-proof__icon[aria-hidden="true"] svg').length, 3);
});

test("contact bar is rendered once on every page and honeypots remain excluded from navigation", () => {
  for (const file of fs
    .readdirSync(path.join(__dirname, "../frontend"))
    .filter((name) => name.endsWith(".html"))) {
    const doc = render(file, { ...config, phone: "", whatsapp: "" });
    const bar = doc('nav.mobile-sticky-actions[aria-label="Direkter Kontakt"]');
    assert.equal(doc(".mobile-sticky-actions").length, 1, file);
    assert.equal(bar.length, 1, file);
    assert.equal(bar.find("a").length, 2);
    assert.equal(bar.find('[aria-hidden="true"] svg').length, 2);
    assert.equal(bar.find("a[href]").length, 0, "placeholder phone numbers stay disabled");
    doc('[name="website"]').each((_, input) => {
      assert.equal(doc(input).attr("tabindex"), "-1");
      assert.equal(doc(input).attr("autocomplete"), "off");
      assert.equal(doc(input).closest(".honeypot").attr("aria-hidden"), "true");
    });
  }
  const ready = render("kontakt.html", {
    ...config,
    phone: "+49 30 12345678",
    whatsapp: "https://wa.me/493012345678",
  });
  assert.equal(ready(".mobile-sticky-actions [data-call-link]").attr("href"), "tel:+493012345678");
  assert.match(
    ready(".mobile-sticky-actions [data-whatsapp-link]").attr("href"),
    /^https:\/\/wa.me\/493012345678/,
  );
  assert.equal(ready(".mobile-sticky-actions small").text(), "");
});
test("photo inquiry preserves contact actions, copy and decorative server icons", () => {
  const doc = render("pakete.html", { ...config, whatsapp: "" });
  const section = doc(".pricing-photo");
  assert.equal(section.find("h2").text(), "Fotos helfen bei der ersten Einschätzung.");
  assert.equal(section.find(".pricing-photo__action").length, 2);
  assert.equal(section.find("[data-whatsapp-link]").attr("href"), undefined);
  assert.equal(section.find("[data-whatsapp-link]").attr("aria-disabled"), "true");
  assert.equal(section.find('.pricing-photo__action[href="/kontakt.html#anfrage"]').length, 1);
  assert.equal(section.find('[data-service-icon="camera"] svg').length, 1);
  assert.equal(section.find('[data-service-icon="notebook-pen"] svg').length, 1);
  assert.equal(section.find(".pricing-photo__image").attr("alt"), "");
  assert.equal(section.find(".pricing-photo__image").attr("loading"), "lazy");
  const ready = render("pakete.html", { ...config, whatsapp: "https://wa.me/493012345678" });
  assert.match(ready(".pricing-photo [data-whatsapp-link]").attr("href"), /^https:\/\/wa.me\/493012345678/);
});

test("only enabled packages and active services are rendered", () => {
  for (const enabled of [false, undefined, "true"]) {
    const doc = render("pakete.html", { ...config, packagesEnabled: enabled });
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
  const doc = render("pakete.html");
  const cards = doc("[data-packages-grid] > .package");
  assert.equal(cards.length, config.packages.length);
  assert.deepEqual(
    cards.map((_, card) => doc(card).attr("data-package-name")).get(),
    config.packages.map((item) => item.name),
  );
  config.packages.forEach((item, index) => {
    const card = cards.eq(index);
    assert.equal(card.attr("id"), `package-${item.id}`);
    assert.equal(card.find(".package__icon").attr("data-service-icon"), item.icon);
    assert.equal(card.find("h2").text(), item.name);
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
test("homepage previews omit checklists while detail cards use central highlights and matching anchors", () => {
  for (const fixture of [
    config,
    {
      ...config,
      services: config.services
        .map((service, index) => ({
          ...service,
          active: index !== 1,
          highlights: Array.from({ length: 6 }, (_, i) => `Fixture ${index} / ${i} <safe>`),
        }))
        .reverse(),
    },
  ]) {
    const home = render("index.html", fixture);
    const detail = render("leistungen.html", fixture);
    const services = fixture.services.filter((service) => service.active !== false);
    assert.equal(home(".service-card--overview").length, services.length);
    assert.equal(detail(".service-card--premium").length, services.length);
    assert.equal(home(".service-card__process").length, 0);
    assert.equal(home(".service-checklist").length, 0);
    services.forEach((service, index) => {
      const card = home(".service-card--overview").eq(index);
      const target = detail(`#service-${service.slug}`);
      assert.equal(card.find("h3").text(), service.title);
      assert.equal(
        card.find(".service-card__details").attr("href"),
        `/leistungen.html#service-${service.slug}`,
      );
      assert.equal(target.length, 1);
      assert.equal(
        target.find(".service-card__primary").attr("href"),
        `/kontakt.html?service=${encodeURIComponent(service.slug)}#anfrage`,
      );
      assert.equal(target.find("h2").text(), service.title);
      for (const [element, values] of [
        [card, []],
        [target, service.highlights],
      ]) {
        assert.deepEqual(
          element
            .find(".service-checklist li > span:last-child")
            .map((_, el) => (element === card ? home : detail)(el).text())
            .get(),
          values,
        );
        assert.equal(element.find(".service-checklist svg").length, values.length);
      }
      assert.deepEqual(
        target
          .find(".service-card__process li")
          .map((_, el) => detail(el).text())
          .get(),
        service.cardSteps.map((step) => step.label),
      );
    });
  }
});
test("header and footer share the same five navigation links on every template that has navigation", () => {
  const expected = [
    ["Home", "/"],
    ["Unsere Leistungen", "/leistungen.html"],
    ["Pakete", "/pakete.html"],
    ["Kontakt", "/kontakt.html"],
    ["FAQ", "/#faq"],
  ];
  for (const file of fs
    .readdirSync(path.join(__dirname, "../frontend"))
    .filter((name) => name.endsWith(".html"))) {
    const doc = render(file);
    for (const selector of [".nav-links", "[data-footer-navigation]"]) {
      if (!doc(selector).length) continue;
      assert.deepEqual(
        doc(`${selector} > a`)
          .toArray()
          .map((el) => [doc(el).text(), doc(el).attr("href")]),
        expected,
        `${file} ${selector}`,
      );
    }
    assert.equal(doc('.site-header a[href="/#ablauf"], .site-footer a[href="/#ablauf"]').length, 0);
  }
  const home = render("index.html");
  assert.equal(home('.nav-links a[aria-current="page"]').attr("href"), "/");
  assert.equal(home("#ablauf .process-line__item").length, 4);
  assert.equal(home("#hero-title").text(), "Autoaufbereitung.Bis ins Detail.");
  assert.ok(!home("#hero-title").html().includes("\u00ad"));
});
test("header and footer identify the same current page in server HTML", () => {
  const pages = {
    "index.html": "/",
    "leistungen.html": "/leistungen.html",
    "pakete.html": "/pakete.html",
    "kontakt.html": "/kontakt.html",
    "impressum.html": null,
    "datenschutz.html": null,
    ...Object.fromEntries(config.services.map((service) => [`${service.slug}.html`, "/leistungen.html"])),
  };
  for (const [file, expected] of Object.entries(pages)) {
    const doc = render(file);
    for (const selector of [".nav-links", "[data-footer-navigation]"]) {
      const active = doc(`${selector} > a[aria-current="page"]`);
      assert.equal(active.length, expected ? 1 : 0, `${file} ${selector}`);
      if (expected) assert.equal(active.attr("href"), expected, `${file} ${selector}`);
    }
  }
});
test("package page starts with its headline and renders configured feature lists without defaults", () => {
  const fixture = {
    ...config,
    packages: config.packages.map((item, index) => ({
      ...item,
      features: index === 1 ? [] : ["Fixture A", "Fixture B"],
    })),
  };
  const doc = render("pakete.html", fixture);
  assert.equal(doc("h1").text(), "Unsere Pakete im Detail.");
  assert.equal(doc("main > section").first().attr("id"), "pakete");
  assert.equal(doc(".pricing-intro").length, 0);
  fixture.packages.forEach((item, index) => {
    const card = doc(".package").eq(index);
    assert.equal(card.find(".package__features").length, item.features.length ? 1 : 0);
    if (item.features.length) {
      assert.equal(card.find(".package__features h3").text(), "Enthaltene Leistungen");
      assert.equal(card.find("ul").attr("aria-labelledby"), card.find(".package__features h3").attr("id"));
      assert.equal(card.find("ul").attr("role"), "list");
      assert.ok(card.html().indexOf("package__features") < card.html().indexOf("package__price"));
    }
    assert.deepEqual(
      card
        .find("li > span:last-child")
        .map((_, el) => doc(el).text())
        .get(),
      item.features,
    );
    assert.equal(card.find("li svg").length, item.features.length);
  });
  assert.equal(render("pakete.html", { ...config, packagesEnabled: false })("h1").length, 1);
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
  const packages = render("pakete.html", {
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
  assert.ok(
    home("[data-city]")
      .toArray()
      .every((item) => home(item).text() === "TESTORT"),
  );
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
