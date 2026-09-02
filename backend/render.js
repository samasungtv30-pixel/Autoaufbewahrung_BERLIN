const fs = require("node:fs");
const path = require("node:path");
const { load } = require("cheerio");
const business = require("../frontend/js/business");
const frontend = path.join(__dirname, "../frontend");
const cache = new Map();
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );
const json = (value) =>
  JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
const icon = (name) => `<span data-service-icon="${escape(name)}" aria-hidden="true"></span>`;
const number = (index) => String(index + 1).padStart(2, "0");
const navigation = [
  { name: "Home", href: "/" },
  { name: "Unsere Leistungen", href: "/leistungen.html" },
  { name: "Pakete", href: "/pakete.html" },
  { name: "Kontakt", href: "/kontakt.html" },
  { name: "FAQ", href: "/#faq" },
];

function localImage(value) {
  return /^\/images\/[a-z0-9-]+\.(?:webp|png|jpe?g|svg)$/i.test(value || "")
    ? value
    : "/images/premium-hero-v2.jpg";
}
function serviceCard(service, index, teaser, config) {
  const slug = escape(service.slug);
  const image = `<img src="${escape(localImage(service.image))}" alt="${escape(service.imageAlt)}" width="1536" height="1024" loading="${!teaser && index === 0 ? "eager" : "lazy"}"${!teaser && index === 0 ? ' fetchpriority="high"' : ""}>`;
  // Detailed cards use the central highlights; the homepage is a preview only.
  const highlights = Array.isArray(service.highlights) ? service.highlights : [];
  const checklist = teaser
    ? ""
    : `<ul class="service-checklist" aria-label="Leistungsmerkmale: ${escape(service.title)}">${highlights.map((feature) => `<li>${icon("check")}<span>${escape(feature)}</span></li>`).join("")}</ul>`;
  const heading = teaser ? "h3" : "h2";
  const process =
    !teaser && service.cardSteps?.length
      ? `<ol class="service-card__process" aria-label="Typischer Ablauf: ${escape(service.title)}">${service.cardSteps.map((step) => `<li>${escape(step.label)}</li>`).join("")}</ol>`
      : "";
  const theme = ["lime", "blue", "orange", "violet", "red", "teal", "yellow"].includes(service.theme)
    ? service.theme
    : "lime";
  const whatsapp = business.contactLinks(
    config,
    `Hallo, ich möchte ein Angebot für ${service.title} anfragen.`,
  ).whatsapp;
  const actions = teaser
    ? `<a class="service-card__details" href="/leistungen.html#service-${slug}" aria-label="Mehr Details: ${escape(service.title)}">Mehr Details ${icon("arrow-right")}</a>`
    : `<div class="service-card__actions"><a class="service-card__primary" href="/kontakt.html?service=${encodeURIComponent(service.slug)}#anfrage">Angebot anfragen</a>
        <a class="service-card__chat${whatsapp ? "" : " is-unavailable"}" ${whatsapp ? `href="${escape(whatsapp)}"` : 'aria-disabled="true" tabindex="-1" title="WhatsApp-Nummer folgt"'} target="_blank" rel="noopener noreferrer" aria-label="${escape(service.title)} per WhatsApp anfragen">${icon("message-circle")}</a>
      </div>`;
  return `<article class="service-card service-card--premium service-card--${theme}${teaser ? " service-card--overview" : ""}" id="service-${slug}" aria-labelledby="service-title-${slug}">
    <div class="service-card__media">${image}</div><div class="service-card__body">
      <div class="service-card__heading"><span aria-hidden="true">${number(index)}</span><${heading} id="service-title-${slug}">${escape(service.title).replace(/(aufbereitung|reparatur)/g, "<wbr>$1")}</${heading}></div>
      <p>${escape(service.summary)}</p>
      ${checklist}${process}${actions}</div></article>`;
}
function packageCard(item, index) {
  const id = /^[a-z0-9-]+$/.test(item.id || "") ? item.id : number(index);
  const titleId = `package-title-${id}`;
  const packageIcon = ["brush-cleaning", "sparkles", "layers-2"].includes(item.icon) ? item.icon : "layers-2";
  const features = Array.isArray(item.features) ? item.features : [];
  const suffix = item.priceSuffix ? `<small>${escape(item.priceSuffix)}</small>` : "";
  const featureList = features.length
    ? `<div class="package__features"><h3 id="package-features-${id}">Enthaltene Leistungen</h3><ul aria-labelledby="package-features-${id}" role="list">${features.map((feature) => `<li>${icon("check")}<span>${escape(feature)}</span></li>`).join("")}</ul></div>`
    : "";
  return `<article class="package package--${["lime", "blue", "teal"][index % 3]}${item.highlighted === true ? " package--featured" : ""}" id="package-${id}" data-package-name="${escape(item.name)}" aria-labelledby="${titleId}">
    <div class="package__top"><span class="package__label">${number(index)} / Pflegepaket</span><span class="package__icon" data-service-icon="${packageIcon}" aria-hidden="true"></span></div>
    <h2 id="${titleId}">${escape(item.name)}</h2><p>${escape(item.shortDescription)}</p>
    ${featureList}
    <div class="package__price"><span>Individuelles Angebot</span><strong>${escape(item.price)}</strong>${suffix}</div>
    <a class="button package__cta" href="/kontakt.html?paket=${encodeURIComponent(item.name)}#anfrage" aria-label="Pflegepaket ${escape(item.name)} anfragen">${escape(item.cta)}${icon("arrow-up-right")}</a></article>`;
}
function schemaFor(config) {
  if (
    config.indexingEnabled !== true ||
    business.hasPlaceholder(config.siteName) ||
    !business.hasUsableAddress(config.address) ||
    !business.hasUsablePhone(config.phone) ||
    !business.hasUsableEmail(config.email)
  )
    return null;
  const schema = {
    "@context": "https://schema.org",
    "@type": "AutomotiveBusiness",
    "@id": `${new URL(config.publicUrl).origin}/#business`,
    name: config.siteName,
    url: config.publicUrl,
    telephone: config.phone,
    email: config.email,
    image: `${new URL(config.publicUrl).origin}${localImage(config.logo)}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: config.address.street,
      postalCode: config.address.zip,
      addressLocality: config.address.city,
      addressCountry: config.address.country,
    },
  };
  if (business.coordinates(config.address))
    schema.geo = {
      "@type": "GeoCoordinates",
      latitude: config.address.latitude,
      longitude: config.address.longitude,
    };
  const social = (config.socialLinks || []).map(business.safeHttps).filter(Boolean);
  if (social.length) schema.sameAs = social;
  const hours = (config.openingHours || []).filter(
    (item) =>
      Array.isArray(item.schemaDays) &&
      item.schemaDays.length &&
      item.schemaDays.every((day) =>
        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].includes(day),
      ) &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(item.opens || "") &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(item.closes || ""),
  );
  if (hours.length)
    schema.openingHoursSpecification = hours.map((item) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: item.schemaDays,
      opens: item.opens,
      closes: item.closes,
    }));
  return schema;
}

function renderHtml(filePath, config) {
  const key = `${fs.statSync(filePath).mtimeMs}:${JSON.stringify(config)}`;
  if (cache.get(filePath)?.key === key) return cache.get(filePath).html;
  const $ = load(fs.readFileSync(filePath, "utf8"));
  const filename = path.basename(filePath);
  const origin = new URL(config.publicUrl).origin;
  const pagePath = filename === "index.html" ? "/" : `/${filename}`;
  const service = config.services.find((item) => `${item.slug}.html` === filename && item.active !== false);
  const active = config.services.filter((item) => item.active !== false);
  const setText = (selector, value) => $(selector).text(value ?? "");
  const links = business.contactLinks(config);
  $('link[href^="/css/style.css"]').attr("href", "/css/style.css?v=31");
  $('link[href^="/css/studio.css"]').attr("href", "/css/studio.css?v=28");
  $('script[src^="/js/main.js"]').attr("src", "/js/main.js?v=29");
  const action = (selector, href) => {
    $(selector).each((_, element) => {
      const el = $(element).toggleClass("is-unavailable", !href);
      if (href) el.attr("href", href).removeAttr("aria-disabled tabindex");
      else el.removeAttr("href").attr({ "aria-disabled": "true", tabindex: "-1" });
    });
  };
  const menu = navigation.map(({ name, href }) => `<a href="${href}">${name}</a>`).join("");
  $(".nav-links, [data-footer-navigation]").html(menu);
  const sticky = `<nav class="mobile-sticky-actions" aria-label="Direkter Kontakt">
    <a class="button button--primary" data-whatsapp-link href="#" target="_blank" rel="noopener noreferrer">${icon("message-circle")}<span>WhatsApp<small>${links.whatsapp ? "" : "Nummer folgt"}</small></span></a>
    <a class="button button--dark" data-call-link href="#">${icon("phone")}<span>Anrufen<small>${links.phone ? "" : "Nummer folgt"}</small></span></a>
  </nav>`;
  if ($(".mobile-sticky-actions").length) $(".mobile-sticky-actions").replaceWith(sticky);
  else $("body").append(sticky);
  $(".site-header").prepend(`<div class="header-utility">
    <div class="header-utility__inner">
      <p><span class="header-utility__pulse" aria-hidden="true"></span>Premium Fahrzeugpflege <span data-city></span></p>
    </div>
  </div>`);
  $(".site-header .nav-quote").remove();
  $(".site-header .nav-actions").append(
    `<a class="nav-whatsapp" data-whatsapp-link href="#" target="_blank" rel="noopener noreferrer"><img src="/images/whatsapp.svg" width="24" height="24" alt=""><span>WhatsApp</span></a>`,
  );
  setText("[data-site-name]", config.siteName);
  setText("[data-short-name]", config.shortName);
  setText("[data-claim]", config.claim);
  setText("[data-phone]", config.phone);
  setText("[data-email]", config.email);
  setText("[data-address]", business.addressText(config.address));
  setText("[data-city]", config.address.city);
  $("[data-brand-logo]").attr({ src: localImage(config.logo), alt: config.logoAlt || config.shortName });
  for (const field of ["owner", "legalForm", "register", "vatId", "contentResponsible"]) {
    setText(`[data-legal="${field}"]`, config.legal?.[field]);
  }
  action("[data-call-link]", links.phone);
  action("[data-whatsapp-link]", links.whatsapp);
  action("[data-mail-link]", links.email);
  action("[data-maps-link]", links.route);
  $("[data-opening-hours]").html(
    config.openingHours
      .map((item) => `<li><span>${escape(item.day)}</span><strong>${escape(item.hours)}</strong></li>`)
      .join(""),
  );
  $("[data-services-grid]").each((_, element) => {
    const grid = $(element);
    const requested = (grid.attr("data-services-slugs") || "").split(",").filter(Boolean);
    const selected = requested.length
      ? requested.map((slug) => active.find((item) => item.slug === slug)).filter(Boolean)
      : active;
    const limit = Number.parseInt(grid.attr("data-services-limit"), 10);
    grid.html(
      selected
        .slice(0, Number.isFinite(limit) ? limit : selected.length)
        .map((item, index) =>
          serviceCard(item, index, grid.attr("data-services-variant") === "home-teaser", config),
        )
        .join(""),
    );
  });
  if (config.packagesEnabled === true && config.packages.length) {
    $("[data-packages-section]").removeAttr("hidden");
    $("[data-packages-grid]").html(config.packages.map(packageCard).join(""));
  } else $("[data-packages-section]").remove();
  $("[data-faq]").html(
    config.faq
      .map(
        (item) =>
          `<details><summary>${escape(item.question)}</summary><p>${escape(item.answer)}</p></details>`,
      )
      .join(""),
  );
  $("#service").html(
    `<option value="">Bitte wählen</option>${active.map((item) => `<option value="${escape(item.title)}">${escape(item.title)}</option>`).join("")}`,
  );
  if (service) {
    for (const field of ["title", "summary", "duration", "suitableFor", "priceFrom"]) {
      const attribute = { suitableFor: "suitable", priceFrom: "price" }[field] || field;
      setText(`[data-service-${attribute}]`, service[field]);
    }
    for (const [attribute, field] of [
      ["list", "highlights"],
      ["benefits", "benefits"],
      ["steps", "steps"],
    ]) {
      $(`[data-service-${attribute}]`).html(
        service[field]
          .map(
            (item, index) =>
              `<li>${field === "steps" ? `<span>${number(index)}</span>` : ""}${escape(item)}</li>`,
          )
          .join(""),
      );
    }
    $(".service-hero").prepend(
      `<img class="service-hero__media" src="${escape(localImage(service.image))}" alt="${escape(service.imageAlt)}" width="1536" height="1024" fetchpriority="high"><span class="service-hero__shade" aria-hidden="true"></span>`,
    );
    action(
      "[data-service-whatsapp]",
      business.contactLinks(config, `Hallo, ich möchte ein Angebot für ${service.title} anfragen.`).whatsapp,
    );
    $('main a[href="/kontakt.html#anfrage"]').attr(
      "href",
      `/kontakt.html?service=${encodeURIComponent(service.slug)}#anfrage`,
    );
  }
  if (!links.map) {
    $("[data-map-load]").attr("disabled", "").text("Adresse noch offen");
    setText(
      "[data-map-copy]",
      "Die genaue Adresse wird noch ergänzt. Fragen zur Anfahrt können Sie uns über das Formular senden.",
    );
  }
  $(".nav-links > a, [data-footer-navigation] > a").each((_, el) => {
    if ($(el).attr("href") === pagePath || (service && $(el).attr("href") === "/leistungen.html"))
      $(el).attr("aria-current", "page");
  });
  $("a[target='_blank']").attr("rel", "noopener noreferrer");
  // Local, allow-listed SVGs are trusted assets, not user-supplied markup.
  $("[data-service-icon]").each((_, el) => {
    const name = $(el).attr("data-service-icon");
    if (!/^[a-z0-9-]+$/.test(name)) return;
    const file = path.join(frontend, "icons", `${name}.svg`);
    if (!fs.existsSync(file)) return;
    const svg = load(fs.readFileSync(file, "utf8"), { xml: true });
    svg("svg").removeAttr("width height").attr({ "aria-hidden": "true", focusable: "false" });
    $(el).html(svg.xml());
  });
  const title = service
    ? `${service.title} | ${config.siteName}`
    : filename === "index.html"
      ? `${config.siteName} | Premium Autoaufbereitung`
      : $("title")
          .text()
          .replace(/\| Autoaufbereitung$/, `| ${config.siteName}`);
  $("title").text(title);
  const canonical = `${origin}${pagePath}`;
  const description = $('meta[name="description"]').attr("content") || config.claim;
  const meta = {
    "og:title": title,
    "og:description": description,
    "og:type": "website",
    "og:locale": "de_DE",
    "og:url": canonical,
    "og:image": `${origin}${localImage(service?.image || "/images/premium-hero-v2.jpg")}`,
    "og:image:alt": service?.imageAlt || config.claim,
  };
  $("head").append(
    `<link rel="canonical" href="${escape(canonical)}"><link rel="icon" type="image/svg+xml" href="${escape(localImage(config.logo))}">`,
  );
  for (const [property, content] of Object.entries(meta))
    $("head").append(`<meta property="${property}" content="${escape(content)}">`);
  $("head").append('<meta name="twitter:card" content="summary_large_image">');
  $("head").append('<noscript><link rel="stylesheet" href="/css/no-script.css?v=2"></noscript>');
  const schema = schemaFor(config);
  if (schema && !["404.html", "impressum.html", "datenschutz.html"].includes(filename))
    $("head").append(`<script type="application/ld+json">${json(schema)}</script>`);
  $("body").append(`<script id="site-config" type="application/json">${json(publicConfig(config))}</script>`);
  $("html").attr("data-rendered", "server");
  const html = $.html();
  if (cache.size >= 20) cache.clear();
  cache.set(filePath, { key, html });
  return html;
}

function publicConfig(config) {
  const { street, zip, city, country, latitude, longitude } = config.address || {};
  return {
    siteName: config.siteName,
    phone: config.phone,
    email: config.email,
    whatsapp: config.whatsapp,
    address: { street, zip, city, country, latitude, longitude },
    services: config.services
      .filter((item) => item.active !== false)
      .map(({ slug, title }) => ({ slug, title })),
    packagesConfirmed: config.packagesConfirmed,
    packagesEnabled: config.packagesEnabled,
    packages: config.packagesEnabled === true ? config.packages.map(({ name }) => ({ name })) : [],
  };
}
module.exports = { renderHtml, schemaFor, publicConfig };
