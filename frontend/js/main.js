const SERVICE_PAGE_SLUGS = {
  "/innenreinigung.html": "innenreinigung",
  "/aussenreinigung.html": "aussenreinigung",
  "/komplettaufbereitung.html": "komplettaufbereitung",
  "/lackaufbereitung.html": "lackaufbereitung",
  "/keramikversiegelung.html": "keramikversiegelung",
  "/felgenreparatur.html": "felgenreparatur",
  "/leasing.html": "leasing"
};

let siteConfig = null;

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
const activeServices = () => siteConfig.services.filter((service) => service.active !== false);

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanPhone(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

function whatsappUrl(message) {
  const base = siteConfig?.whatsapp || "";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}text=${encodeURIComponent(message)}`;
}

function hasPlaceholder(value) {
  return /\[[^\]]+\]/.test(String(value || ""));
}

function hasUsablePhone(value) {
  const digits = cleanPhone(value).replace(/\D/g, "").replace(/^49/, "");
  return digits.length >= 6 && !/^0+$/.test(digits);
}

function hasUsableEmail(value) {
  const email = String(value || "").trim();
  return !hasPlaceholder(email) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/\.example$/i.test(email);
}

function hasUsableAddress() {
  if (!siteConfig?.address) return false;
  return [siteConfig.address.street, siteConfig.address.zip, siteConfig.address.city]
    .every((value) => String(value || "").trim() && !hasPlaceholder(value));
}

function setActionAvailability(selector, available, href) {
  qsa(selector).forEach((element) => {
    element.classList.toggle("is-unavailable", !available);
    if (available) {
      element.href = href;
      element.removeAttribute("aria-disabled");
      element.removeAttribute("tabindex");
    } else {
      element.removeAttribute("href");
      element.setAttribute("aria-disabled", "true");
      element.setAttribute("tabindex", "-1");
    }
  });
}

async function loadConfig() {
  const response = await fetch(`/api/config?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Konfiguration konnte nicht geladen werden.");
  siteConfig = await response.json();
  window.siteConfig = siteConfig;
}

function applyGlobalConfig() {
  if (document.body.classList.contains("home")) {
    document.title = `${siteConfig.siteName} | Premium Autoaufbereitung`;
  } else if (document.title.endsWith("| Autoaufbereitung")) {
    document.title = document.title.replace(/\| Autoaufbereitung$/, `| ${siteConfig.siteName}`);
  }
  const descriptionMeta = qs('meta[name="description"]');
  if (descriptionMeta && !descriptionMeta.content.trim()) descriptionMeta.content = siteConfig.claim;
  const canonicalUrl = `${siteConfig.publicUrl.replace(/\/+$/, "")}${window.location.pathname === "/index.html" ? "/" : window.location.pathname}`;
  let canonical = qs('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.append(canonical);
  }
  canonical.href = canonicalUrl;
  const socialMeta = {
    "og:title": document.title,
    "og:description": descriptionMeta?.content || siteConfig.claim,
    "og:type": "website",
    "og:url": canonicalUrl,
    "og:image": `${siteConfig.publicUrl.replace(/\/+$/, "")}/images/premium-hero.webp`
  };
  Object.entries(socialMeta).forEach(([property, content]) => {
    let meta = qs(`meta[property="${property}"]`);
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("property", property);
      document.head.append(meta);
    }
    meta.content = content;
  });
  const businessDataIsComplete = ![
    siteConfig.siteName,
    siteConfig.phone,
    siteConfig.email,
    siteConfig.address.street,
    siteConfig.address.zip,
    siteConfig.address.city
  ].some(hasPlaceholder);
  if (businessDataIsComplete) {
    const schema = document.createElement("script");
    schema.type = "application/ld+json";
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "AutoRepair",
      name: siteConfig.siteName,
      url: siteConfig.publicUrl,
      telephone: siteConfig.phone,
      email: siteConfig.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: siteConfig.address.street,
        postalCode: siteConfig.address.zip,
        addressLocality: siteConfig.address.city,
        addressCountry: "DE"
      }
    });
    document.head.append(schema);
  }
  qsa("[data-site-name]").forEach((el) => { el.textContent = siteConfig.siteName; });
  qsa("[data-brand-logo]").forEach((el) => {
    el.src = siteConfig.logo || "/images/brand-logo.svg";
    el.alt = siteConfig.logoAlt || "Autoaufbereitung Berlin";
  });
  qsa("[data-claim]").forEach((el) => { el.textContent = siteConfig.claim; });
  qsa("[data-phone]").forEach((el) => { el.textContent = siteConfig.phone; });
  qsa("[data-address]").forEach((el) => {
    el.textContent = `${siteConfig.address.street}, ${siteConfig.address.zip} ${siteConfig.address.city}`;
  });
  qsa("[data-email]").forEach((el) => { el.textContent = siteConfig.email; });
  const phoneAvailable = hasUsablePhone(siteConfig.phone);
  const whatsappAvailable = hasUsablePhone(siteConfig.whatsapp);
  const emailAvailable = hasUsableEmail(siteConfig.email);
  const mapsAvailable = hasUsableAddress() && /^https:\/\//i.test(siteConfig.address.mapsUrl || "");
  setActionAvailability("[data-call-link]", phoneAvailable, `tel:${cleanPhone(siteConfig.phone)}`);
  setActionAvailability("[data-whatsapp-link]", whatsappAvailable, whatsappUrl("Hallo, ich möchte ein Angebot für eine Autoaufbereitung anfragen."));
  setActionAvailability("[data-mail-link]", emailAvailable, `mailto:${siteConfig.email}`);
  setActionAvailability("[data-maps-link]", mapsAvailable, siteConfig.address.mapsUrl);
  qsa(".mobile-sticky-actions a").forEach((link) => {
    const unavailable = link.getAttribute("aria-disabled") === "true";
    qs("small", link).textContent = unavailable ? "Nummer folgt" : "";
    link.title = unavailable ? "Die Kontaktnummer wird noch ergänzt. Bitte nutzen Sie das Anfrageformular." : "";
  });
}

function renderServices(limit = 99) {
  const grid = qs("[data-services-grid]");
  if (!grid) return;
  const requestedSlugs = String(grid.dataset.servicesSlugs || "").split(",").map((slug) => slug.trim()).filter(Boolean);
  const orderedServices = requestedSlugs.length
    ? requestedSlugs.map((slug) => activeServices().find((service) => service.slug === slug)).filter(Boolean)
    : activeServices();
  const configuredLimit = Number.parseInt(grid.dataset.servicesLimit || "", 10);
  const services = orderedServices.slice(0, Number.isFinite(configuredLimit) ? configuredLimit : limit);
  const jump = qs("[data-service-jump]");
  if (jump) {
    jump.innerHTML = services.map((service) => `
      <a href="#service-${escapeHtml(service.slug)}">${escapeHtml(service.navTitle || service.title)}</a>
    `).join("");
  }
  if (grid.dataset.servicesVariant === "home-teaser") {
    grid.innerHTML = services.map((service, index) => `
      <article class="home-service-card">
        <a class="home-service-card__media" href="/leistungen.html#service-${escapeHtml(service.slug)}" tabindex="-1">
          <img src="${escapeHtml(service.image)}" alt="${escapeHtml(service.imageAlt)}" width="1536" height="1024" loading="lazy">
        </a>
        <div class="home-service-card__body">
          <span class="home-service-card__icon" data-service-icon="${String(service.cardSteps[0]?.icon || "sparkles").replace(/[^a-z0-9-]/gi, "")}" aria-hidden="true"></span>
          <span class="home-service-card__number">${String(index + 1).padStart(2, "0")}</span>
          <h3>${escapeHtml(service.title)}</h3>
          <p>${escapeHtml(service.summary)}</p>
          <a class="home-service-card__details" href="/leistungen.html#service-${escapeHtml(service.slug)}" aria-label="Details zur Leistung ${escapeHtml(service.title)}">Details ansehen <span data-service-icon="arrow-up-right" aria-hidden="true"></span></a>
        </div>
      </article>
    `).join("");
    const process = qs("[data-featured-process]");
    const processRoot = qs("[data-featured-service]");
    const featured = activeServices().find((service) => service.slug === processRoot?.dataset.featuredService) || services[0];
    if (process && featured) {
      qs("[data-featured-process-title]").textContent = `So läuft ${featured.title} ab.`;
      process.innerHTML = featured.cardSteps.map((step, index) => `
        <li>
          <small>${String(index + 1).padStart(2, "0")}</small>
          <span data-service-icon="${String(step.icon).replace(/[^a-z0-9-]/gi, "")}" aria-hidden="true"></span>
          <strong>${escapeHtml(step.label)}</strong>
        </li>
      `).join("");
    }
    return;
  }
  if (document.body.classList.contains("services-page") || document.body.classList.contains("home")) {
    grid.innerHTML = services.map((service, index) => {
      const themes = ["lime", "blue", "orange", "violet", "red", "teal", "yellow"];
      const theme = themes.includes(service.theme) ? service.theme : "lime";
      const steps = service.cardSteps.map((step) => {
        return `
          <li>
            <span data-service-icon="circle-check-big" aria-hidden="true"></span>
            <span>${escapeHtml(step.label)}</span>
          </li>
        `;
      }).join("");
      return `
        <article class="service-card service-card--premium service-card--${theme}" id="service-${escapeHtml(service.slug)}">
          <div class="service-card__media">
            <img src="${escapeHtml(service.image)}" alt="${escapeHtml(service.imageAlt)}" width="1536" height="1024" loading="lazy">
          </div>
          <div class="service-card__body">
            <div class="service-card__heading">
              <span>${String(index + 1).padStart(2, "0")}</span>
              <h3>${escapeHtml(service.title)}</h3>
            </div>
            <p>${escapeHtml(service.summary)}</p>
            <ul class="service-checklist" aria-label="Typische Arbeitsschritte für ${escapeHtml(service.title)}">${steps}</ul>
            <div class="service-card__actions">
              <a class="service-card__primary" href="/${escapeHtml(service.slug)}.html">Angebot anfragen</a>
              <a class="service-card__chat${hasUsablePhone(siteConfig.whatsapp) ? "" : " is-unavailable"}" ${hasUsablePhone(siteConfig.whatsapp) ? `href="${escapeHtml(whatsappUrl(`Hallo, ich möchte ein Angebot für ${service.title} anfragen.`))}"` : 'aria-disabled="true" tabindex="-1" title="WhatsApp-Nummer folgt"'} target="_blank" rel="noopener" aria-label="${escapeHtml(service.title)} per WhatsApp anfragen">
                <span data-service-icon="message-circle" aria-hidden="true"></span>
              </a>
            </div>
          </div>
        </article>
      `;
    }).join("");
    return;
  }
  grid.innerHTML = services.map((service, index) => `
    <article class="service-card">
      <div class="service-card__media">
        <img src="${escapeHtml(service.image)}" alt="${escapeHtml(service.imageAlt)}" width="1536" height="1024" loading="lazy">
      </div>
      <div class="service-card__top">
        <span class="icon-badge" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
        <span>${escapeHtml(service.duration)}</span>
      </div>
      <h3>${escapeHtml(service.title)}</h3>
      <p>${escapeHtml(service.summary)}</p>
      <div class="service-card__footer">
        <strong>${escapeHtml(service.priceFrom)}</strong>
        <a href="/${escapeHtml(service.slug)}.html">Angebot anfragen</a>
      </div>
    </article>
  `).join("");
}

async function hydrateServiceIcons() {
  const targets = qsa("[data-service-icon]");
  if (!targets.length) return;
  const cache = new Map();
  await Promise.all(targets.map(async (target) => {
    const icon = String(target.dataset.serviceIcon || "").replace(/[^a-z0-9-]/gi, "");
    if (!icon) return;
    if (!cache.has(icon)) {
      cache.set(icon, fetch(`/icons/${icon}.svg`).then(async (response) => {
        if (!response.ok) throw new Error(`Icon konnte nicht geladen werden: ${icon}`);
        const documentNode = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
        const svg = documentNode.documentElement;
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        return svg;
      }));
    }
    const svg = await cache.get(icon);
    target.replaceChildren(document.importNode(svg, true));
  }));
}

function initServiceTimelines() {
  qsa(".service-card__timeline, .process-strip").forEach((timeline) => {
    timeline.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      timeline.scrollBy({ left: direction * 72, behavior: "smooth" });
    });
  });
}

function initServiceDeepLinks() {
  if (!document.body.classList.contains("services-page")) return;
  const revealTarget = () => {
    const target = document.getElementById(window.location.hash.slice(1));
    if (!target?.classList.contains("service-card--premium")) return;
    // The service cards are loaded from config after the browser's initial anchor jump.
    target.setAttribute("tabindex", "-1");
    target.scrollIntoView({ behavior: "instant", block: "start" });
    target.focus({ preventScroll: true });
  };
  revealTarget();
  window.addEventListener("hashchange", revealTarget);
}

function renderPackages() {
  const grid = qs("[data-packages-grid]");
  if (!grid) return;
  grid.innerHTML = siteConfig.packages.map((item, index) => `
    <article class="package package--${["lime", "blue", "teal"][index % 3]} ${index === 1 ? "package--featured" : ""}">
      <div class="package__top"><span class="package__label">${String(index + 1).padStart(2, "0")} / Pflegepaket</span><span class="package__icon" data-service-icon="${["brush-cleaning", "sparkles", "layers-2"][index % 3]}" aria-hidden="true"></span></div>
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <div class="package__price"><span>Individuelles Angebot</span><strong>${escapeHtml(item.price)}</strong></div>
      <ul>${item.features.map((feature) => `<li><span data-service-icon="circle-check-big" aria-hidden="true"></span><span>${escapeHtml(feature)}</span></li>`).join("")}</ul>
      <a class="button package__cta" href="/kontakt.html?paket=${encodeURIComponent(item.name)}#anfrage" aria-label="Pflegepaket ${escapeHtml(item.name)} anfragen">Paket anfragen<span data-service-icon="arrow-up-right" aria-hidden="true"></span></a>
    </article>
  `).join("");
}

function renderIndividualServices() {
  const list = qs("[data-individual-services]");
  if (!list) return;
  list.innerHTML = siteConfig.individualServices.map((item) => `<li>${escapeHtml(item)}<span>Preis auf Anfrage</span></li>`).join("");
}

function renderReviews() {
  const grid = qs("[data-reviews-grid]");
  if (!grid) return;
  grid.innerHTML = siteConfig.reviews.map((review) => `
    <figure class="review-card">
      <div aria-label="${review.rating} von 5 Sternen">${"★".repeat(review.rating)}</div>
      <blockquote>${escapeHtml(review.text)}</blockquote>
      <figcaption>${escapeHtml(review.name)}</figcaption>
    </figure>
  `).join("");
}

function renderFaq() {
  const list = qs("[data-faq]");
  if (!list) return;
  list.innerHTML = siteConfig.faq.map((item) => `
    <details>
      <summary>${escapeHtml(item.question)}</summary>
      <p>${escapeHtml(item.answer)}</p>
    </details>
  `).join("");
}

function renderOpeningHours() {
  const list = qs("[data-opening-hours]");
  if (!list) return;
  list.innerHTML = siteConfig.openingHours.map((item) => `
    <li><span>${escapeHtml(item.day)}</span><strong>${escapeHtml(item.hours)}</strong></li>
  `).join("");
}

function renderGallery() {
  const grid = qs("[data-gallery]");
  if (!grid) return;
  const gallery = window.AUTO_DETAILING_DATA?.gallery || [];
  grid.innerHTML = gallery.map((item, index) => `
    <figure class="gallery-item gallery-item--${index + 1}" data-category="${escapeHtml(item.category)}">
      <div class="image-placeholder">
        <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.caption)}" loading="lazy">
        <span>${escapeHtml(item.label)}</span>
      </div>
      <figcaption>${escapeHtml(item.caption)}</figcaption>
    </figure>
  `).join("");
}

function initGalleryFilters() {
  const buttons = qsa("[data-gallery-filter]");
  const items = qsa(".gallery-item");
  if (!buttons.length || !items.length) return;
  buttons.forEach((button) => button.addEventListener("click", () => {
    const category = button.dataset.galleryFilter;
    buttons.forEach((item) => item.classList.toggle("is-active", item === button));
    items.forEach((item) => {
      item.hidden = category !== "all" && item.dataset.category !== category;
    });
  }));
}

function initGalleryLightbox() {
  const items = qsa(".gallery-item");
  if (!items.length) return;

  const lightbox = document.createElement("div");
  lightbox.className = "lightbox";
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-modal", "true");
  lightbox.setAttribute("aria-label", "Galeriebild vergrößert");
  lightbox.innerHTML = `
    <button class="lightbox__close" type="button" aria-label="Galerie schliessen">×</button>
    <figure class="lightbox__content">
      <img alt="">
      <figcaption></figcaption>
    </figure>
  `;
  document.body.append(lightbox);

  let trigger = null;
  const closeButton = qs(".lightbox__close", lightbox);
  const image = qs("img", lightbox);
  const caption = qs("figcaption", lightbox);

  const close = () => {
    lightbox.classList.remove("is-open");
    document.body.classList.remove("lightbox-open");
    trigger?.focus();
  };

  items.forEach((item) => {
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `${qs("figcaption", item)?.textContent || "Galeriebild"} vergrößern`);
    const open = () => {
      const source = qs("img", item);
      trigger = item;
      image.src = source.src;
      image.alt = source.alt;
      caption.textContent = qs("figcaption", item)?.textContent || "";
      lightbox.classList.add("is-open");
      document.body.classList.add("lightbox-open");
      closeButton.focus();
    };
    item.addEventListener("click", open);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });

  closeButton.addEventListener("click", close);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lightbox.classList.contains("is-open")) close();
  });
}

function initMotion() {
  const header = qs(".site-header");
  const progress = document.createElement("div");
  progress.className = "scroll-progress";
  progress.setAttribute("aria-hidden", "true");
  progress.innerHTML = "<span></span>";
  document.body.append(progress);
  const progressBar = qs("span", progress);

  const updateHeader = () => {
    header?.classList.toggle("is-scrolled", window.scrollY > 24);
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
    progressBar.style.transform = `scaleX(${ratio})`;
  };
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  const items = qsa(".reveal");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px" });
  items.forEach((item) => observer.observe(item));
}

function renderServicePage() {
  const slug = SERVICE_PAGE_SLUGS[window.location.pathname];
  if (!slug) return;
  const service = siteConfig.services.find((item) => item.slug === slug);
  if (!service || service.active === false) {
    window.location.replace("/leistungen.html");
    return;
  }
  document.title = `${service.title} | ${siteConfig.siteName}`;
  qs("[data-service-title]").textContent = service.title;
  qs("[data-service-summary]").textContent = service.summary;
  qs("[data-service-price]").textContent = service.priceFrom;
  qs("[data-service-duration]").textContent = service.duration;
  qs("[data-service-list]").innerHTML = service.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  qs("[data-service-suitable]")?.replaceChildren(document.createTextNode(service.suitableFor));
  const benefits = qs("[data-service-benefits]");
  if (benefits) benefits.innerHTML = service.benefits.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const steps = qs("[data-service-steps]");
  if (steps) steps.innerHTML = service.steps.map((item, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(item)}</li>`).join("");
  const hero = qs(".service-hero");
  if (hero && !qs(".service-hero__media", hero)) {
    const image = document.createElement("img");
    image.className = "service-hero__media";
    image.src = service.image;
    image.alt = service.imageAlt;
    image.width = 1536;
    image.height = 1024;
    image.fetchPriority = "high";
    const shade = document.createElement("span");
    shade.className = "service-hero__shade";
    shade.setAttribute("aria-hidden", "true");
    hero.prepend(shade);
    hero.prepend(image);
  }
  qsa("[data-service-whatsapp]").forEach((link) => {
    link.href = whatsappUrl(`Hallo, ich möchte ein Angebot für ${service.title} anfragen.`);
  });
}

function initNav() {
  const toggle = qs(".nav-toggle");
  const panel = qs(".nav-links");
  if (!toggle || !panel) return;

  panel.id = "mobile-navigation";
  toggle.setAttribute("aria-controls", panel.id);
  const currentPath = window.location.pathname;
  qsa(":scope > a", panel).forEach((link) => {
    const href = link.getAttribute("href") || "";
    const isServiceArea = href === "/leistungen.html" && (currentPath === "/leistungen.html" || SERVICE_PAGE_SLUGS[currentPath]);
    const isCurrent = href === currentPath || isServiceArea;
    if (isCurrent) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  panel.insertAdjacentHTML("beforeend", `
    <div class="nav-menu-meta">
      <p>Direkter Kontakt</p>
      <a data-call-link href="#"><span>Telefon</span><strong data-phone></strong></a>
      <a data-whatsapp-link href="#" target="_blank" rel="noopener"><span>WhatsApp</span><strong>Fotos & Anfrage senden</strong></a>
    </div>
  `);

  const backdrop = document.createElement("div");
  backdrop.className = "nav-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  document.body.append(backdrop);

  const close = (restoreFocus = false) => {
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Menü öffnen");
    toggle.classList.remove("is-open");
    panel.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    document.body.classList.remove("nav-open");
    if (restoreFocus) toggle.focus();
  };

  const open = () => {
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Menü schließen");
    toggle.classList.add("is-open");
    panel.classList.add("is-open");
    backdrop.classList.add("is-open");
    document.body.classList.add("nav-open");
    window.setTimeout(() => qs("a", panel)?.focus(), 180);
  };

  toggle.addEventListener("click", () => {
    toggle.getAttribute("aria-expanded") === "true" ? close() : open();
  });
  qsa("a", panel).forEach((link) => link.addEventListener("click", () => close()));
  backdrop.addEventListener("click", () => close(true));
  document.addEventListener("keydown", (event) => {
    if (!panel.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      close(true);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [toggle, ...qsa("a", panel)];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  window.matchMedia("(min-width: 1051px)").addEventListener("change", (event) => {
    if (event.matches) close();
  });
}

function initInquiryForm() {
  const form = qs("#inquiry-form");
  if (!form) return;
  const status = qs("[data-form-status]");
  const serviceSelect = qs("#service", form);
  serviceSelect.innerHTML = `<option value="">Bitte wählen</option>${activeServices().map((service) => `<option value="${escapeHtml(service.title)}">${escapeHtml(service.title)}</option>`).join("")}`;
  const requestedService = new URLSearchParams(window.location.search).get("service");
  const matchingService = activeServices().find((service) => service.slug === requestedService || service.title === requestedService);
  if (matchingService) serviceSelect.value = matchingService.title;
  const requestedPackage = new URLSearchParams(window.location.search).get("paket");
  const matchingPackage = siteConfig.packages.find((item) => item.name === requestedPackage);
  const message = qs('[name="message"]', form);
  if (matchingPackage && message && !message.value) message.value = `Ich interessiere mich für das Pflegepaket ${matchingPackage.name}.`;

  const setStatus = (message, type = "") => {
    status.textContent = message;
    status.classList.toggle("is-success", type === "success");
    status.classList.toggle("is-error", type === "error");
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const submitButton = qs('button[type="submit"]', form);
    setStatus("Anfrage wird gesendet...");
    submitButton.disabled = true;
    form.setAttribute("aria-busy", "true");
    try {
      const response = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Anfrage konnte nicht gesendet werden.");
      if (result.emailSent) {
        setStatus("Vielen Dank. Ihre Anfrage wurde per E-Mail übermittelt.", "success");
      } else if (result.emailStatus === "not_configured") {
        setStatus("Vielen Dank. Ihre Anfrage wurde erfasst. Wir melden uns schnellstmöglich bei Ihnen.", "success");
      } else {
        setStatus("Ihre Anfrage wurde gespeichert, aber die E-Mail-Zustellung konnte nicht bestätigt werden. Bitte nutzen Sie bei dringenden Anliegen Telefon oder WhatsApp.", "error");
      }
      form.reset();
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      submitButton.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });
}

function initContactMap() {
  const shell = qs(".contact-map-shell");
  const frame = qs("[data-map-frame]");
  const consent = qs("[data-map-consent]");
  const button = qs("[data-map-load]");
  const copy = qs("[data-map-copy]");
  if (!shell || !frame || !consent || !button) return;
  if (!hasUsableAddress()) {
    button.disabled = true;
    button.textContent = "Adresse noch offen";
    if (copy) copy.textContent = "Die Kartenansicht wird verfügbar, sobald die vollständige Kundenadresse eingetragen ist.";
    return;
  }
  button.addEventListener("click", () => {
    const address = `${siteConfig.address.street}, ${siteConfig.address.zip} ${siteConfig.address.city}`;
    frame.src = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
    frame.hidden = false;
    consent.hidden = true;
    shell.classList.add("is-loaded");
  }, { once: true });
}

function initStickyActions() {
  let sticky = qs(".mobile-sticky-actions");
  if (!sticky) {
    sticky = document.createElement("div");
    sticky.className = "mobile-sticky-actions";
    document.body.append(sticky);
  }
  sticky.setAttribute("aria-label", "Direkter Kontakt");
  sticky.innerHTML = `
    <a class="button button--dark" data-call-link href="#">
      <span data-service-icon="phone" aria-hidden="true"></span><span>Anrufen<small></small></span>
    </a>
    <a class="button button--primary" data-whatsapp-link href="#" target="_blank" rel="noopener">
      <span data-service-icon="message-circle" aria-hidden="true"></span><span>WhatsApp<small></small></span>
    </a>`;
  const updateKeyboardState = () => {
    sticky.classList.toggle("is-suppressed", Boolean(document.activeElement?.matches("input, textarea, select")));
  };
  document.addEventListener("focusin", updateKeyboardState);
  document.addEventListener("focusout", () => window.setTimeout(updateKeyboardState, 0));
}

async function init() {
  initNav();
  initMotion();
  await loadConfig();
  initStickyActions();
  applyGlobalConfig();
  renderServices();
  renderPackages();
  await hydrateServiceIcons();
  initServiceTimelines();
  renderIndividualServices();
  renderReviews();
  renderFaq();
  renderOpeningHours();
  initContactMap();
  renderGallery();
  initGalleryFilters();
  initGalleryLightbox();
  renderServicePage();
  initInquiryForm();
  initServiceDeepLinks();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    const fallback = qs("[data-app-error]");
    if (fallback) fallback.textContent = "Die Website konnte nicht vollständig geladen werden.";
  });
});
