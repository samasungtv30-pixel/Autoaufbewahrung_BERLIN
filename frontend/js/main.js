const SERVICE_PAGE_SLUGS = {
  "/innenreinigung.html": "innenreinigung",
  "/lackaufbereitung.html": "lackaufbereitung",
  "/keramikversiegelung.html": "keramikversiegelung",
  "/felgenreparatur.html": "felgenreparatur",
  "/leasing.html": "leasing",
  "/smart-repair.html": "smart-repair"
};

let siteConfig = null;

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

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
  qs('meta[name="description"]')?.setAttribute("content", `${siteConfig.claim}. Professionelle Fahrzeugpflege, Felgenreparatur, Keramikversiegelung und Innenreinigung.`);
  qsa("[data-site-name]").forEach((el) => { el.textContent = siteConfig.siteName; });
  qsa("[data-claim]").forEach((el) => { el.textContent = siteConfig.claim; });
  qsa("[data-phone]").forEach((el) => { el.textContent = siteConfig.phone; });
  qsa("[data-address]").forEach((el) => {
    el.textContent = `${siteConfig.address.street}, ${siteConfig.address.zip} ${siteConfig.address.city}`;
  });
  qsa("[data-call-link]").forEach((el) => { el.href = `tel:${cleanPhone(siteConfig.phone)}`; });
  qsa("[data-whatsapp-link]").forEach((el) => {
    el.href = whatsappUrl("Hallo, ich moechte ein Angebot fuer eine Autoaufbereitung anfragen.");
  });
  qsa("[data-mail-link]").forEach((el) => { el.href = `mailto:${siteConfig.email}`; });
  qsa("[data-maps-link]").forEach((el) => { el.href = siteConfig.address.mapsUrl; });

  const map = qs("[data-map]");
  if (map) {
    const query = `${siteConfig.address.street}, ${siteConfig.address.zip} ${siteConfig.address.city}`;
    map.src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  }
}

function renderServices(limit = 99) {
  const grid = qs("[data-services-grid]");
  if (!grid) return;
  grid.innerHTML = siteConfig.services.slice(0, limit).map((service, index) => `
    <article class="service-card">
      <div class="service-card__top">
        <span class="icon-badge" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
        <span>${escapeHtml(service.duration)}</span>
      </div>
      <h3>${escapeHtml(service.title)}</h3>
      <p>${escapeHtml(service.summary)}</p>
      <div class="service-card__footer">
        <strong>${escapeHtml(service.priceFrom)}</strong>
        <a href="/${escapeHtml(service.slug)}.html">Details</a>
      </div>
    </article>
  `).join("");
}

function renderPackages() {
  const grid = qs("[data-packages-grid]");
  if (!grid) return;
  grid.innerHTML = siteConfig.packages.map((item, index) => `
    <article class="package ${index === 1 ? "package--featured" : ""}">
      <span class="package__label">${index === 1 ? "Empfohlen" : "Paket"}</span>
      <h3>${escapeHtml(item.name)}</h3>
      <strong>${escapeHtml(item.price)}</strong>
      <p>${escapeHtml(item.description)}</p>
      <ul>${item.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul>
      <a class="button button--dark" href="${document.body.classList.contains("home") ? "#anfrage" : "/kontakt.html#anfrage"}">Paket anfragen</a>
    </article>
  `).join("");
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
    <figure class="gallery-item gallery-item--${index + 1}">
      <div class="image-placeholder">
        <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.caption)}" loading="lazy">
        <span>${escapeHtml(item.label)}</span>
      </div>
      <figcaption>${escapeHtml(item.caption)}</figcaption>
    </figure>
  `).join("");
}

function initMotion() {
  const header = qs(".site-header");
  const updateHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 24);
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
  if (!service) return;
  document.title = `${service.title} | ${siteConfig.siteName}`;
  qs("[data-service-title]").textContent = service.title;
  qs("[data-service-summary]").textContent = service.summary;
  qs("[data-service-price]").textContent = service.priceFrom;
  qs("[data-service-duration]").textContent = service.duration;
  qs("[data-service-list]").innerHTML = service.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  qs("[data-service-whatsapp]").href = whatsappUrl(`Hallo, ich moechte ein Angebot fuer ${service.title} anfragen.`);
}

function initNav() {
  const toggle = qs(".nav-toggle");
  const panel = qs(".nav-links");
  if (!toggle || !panel) return;
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    panel.classList.toggle("is-open", !expanded);
  });
  qsa(".nav-links a").forEach((link) => {
    link.addEventListener("click", () => {
      toggle.setAttribute("aria-expanded", "false");
      panel.classList.remove("is-open");
    });
  });
}

function initInquiryForm() {
  const form = qs("#inquiry-form");
  if (!form) return;
  const status = qs("[data-form-status]");
  const serviceSelect = qs("#service", form);
  serviceSelect.innerHTML = siteConfig.services.map((service) => `<option value="${escapeHtml(service.title)}">${escapeHtml(service.title)}</option>`).join("");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const submitButton = qs('button[type="submit"]', form);
    status.textContent = "Anfrage wird gesendet...";
    submitButton.disabled = true;
    try {
      const response = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Anfrage konnte nicht gesendet werden.");
      if (result.emailSent) {
        status.textContent = "Vielen Dank. Ihre Anfrage wurde per E-Mail uebermittelt.";
      } else if (result.emailStatus === "not_configured") {
        status.textContent = "Vielen Dank. Ihre Anfrage wurde gespeichert; der E-Mail-Versand wird noch eingerichtet.";
      } else {
        status.textContent = "Ihre Anfrage wurde gespeichert, aber die E-Mail-Zustellung konnte nicht bestaetigt werden. Bitte nutzen Sie bei dringenden Anliegen Telefon oder WhatsApp.";
      }
      form.reset();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });
}

async function init() {
  initNav();
  initMotion();
  await loadConfig();
  applyGlobalConfig();
  renderServices(document.body.classList.contains("home") ? 6 : 99);
  renderPackages();
  renderReviews();
  renderFaq();
  renderOpeningHours();
  renderGallery();
  renderServicePage();
  initInquiryForm();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    const fallback = qs("[data-app-error]");
    if (fallback) fallback.textContent = "Die Website konnte nicht vollstaendig geladen werden.";
  });
});
