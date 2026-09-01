const SERVICE_PAGE_SLUGS = {
  "/innenreinigung.html": "innenreinigung",
  "/aussenreinigung.html": "aussenreinigung",
  "/komplettaufbereitung.html": "komplettaufbereitung",
  "/lackaufbereitung.html": "lackaufbereitung",
  "/keramikversiegelung.html": "keramikversiegelung",
  "/felgenreparatur.html": "felgenreparatur",
  "/leasing.html": "leasing",
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

const hasUsableAddress = () => Boolean(window.AutoBusiness.mapDestination(siteConfig.address));

function loadConfig() {
  const element = document.getElementById("site-config");
  if (!element) throw new Error("Seitenkonfiguration fehlt.");
  siteConfig = JSON.parse(element.textContent);
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

function applyGlobalConfig() {
  qsa("[data-phone]").forEach((el) => {
    el.textContent = siteConfig.phone;
  });
  const links = window.AutoBusiness.contactLinks(siteConfig);
  for (const [selector, href] of Object.entries({
    "[data-call-link]": links.phone,
    "[data-whatsapp-link]": links.whatsapp,
    "[data-mail-link]": links.email,
    "[data-maps-link]": links.route,
  }))
    setActionAvailability(selector, Boolean(href), href);
  qsa(".mobile-sticky-actions a").forEach((link) => {
    const unavailable = link.getAttribute("aria-disabled") === "true";
    const note = qs("small", link);
    if (note) note.textContent = unavailable ? "Nummer folgt" : "";
    link.title = unavailable
      ? "Die Kontaktnummer wird noch ergänzt. Bitte nutzen Sie das Anfrageformular."
      : "";
  });
}

async function hydrateServiceIcons() {
  const targets = qsa("[data-service-icon]");
  if (!targets.length) return;
  const cache = new Map();
  await Promise.allSettled(
    targets.map(async (target) => {
      const icon = String(target.dataset.serviceIcon || "").replace(/[^a-z0-9-]/gi, "");
      if (!icon || qs("svg", target)) return;
      if (!cache.has(icon)) {
        cache.set(
          icon,
          fetch(`/icons/${icon}.svg`).then(async (response) => {
            if (!response.ok) throw new Error(`Icon konnte nicht geladen werden: ${icon}`);
            const documentNode = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
            const svg = documentNode.documentElement;
            svg.removeAttribute("width");
            svg.removeAttribute("height");
            svg.setAttribute("aria-hidden", "true");
            svg.setAttribute("focusable", "false");
            return svg;
          }),
        );
      }
      const svg = await cache.get(icon);
      target.replaceChildren(document.importNode(svg, true));
    }),
  );
}

function initServiceDeepLinks() {
  if (!document.body.classList.contains("services-page")) return;
  const revealTarget = () => {
    const target = document.getElementById(window.location.hash.slice(1));
    if (!target?.classList.contains("service-card--premium")) return;
    // Keep the selected service reachable by keyboard after a deep link.
    target.setAttribute("tabindex", "-1");
    target.scrollIntoView({ behavior: "instant", block: "start" });
    target.focus({ preventScroll: true });
  };
  revealTarget();
  window.addEventListener("hashchange", revealTarget);
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
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        entry.target.classList.remove("is-pending");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.02 },
  );
  items.forEach((item) => {
    item.classList.add("is-pending");
    observer.observe(item);
  });
}

function initPremiumMotion() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.body.classList.add(reducedMotion ? "motion-reduced" : "motion-ready");
  if (reducedMotion) return;

  const imageShells = qsa(
    ".home-service-card__media, .service-card__media, .image-story__media, .image-placeholder, .contact-map-shell",
  );
  imageShells.forEach((element) => element.classList.add("motion-image-reveal"));

  const processLines = qsa(".process-line");
  if ("IntersectionObserver" in window) {
    const imageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          imageShells
            .filter((shell) => entry.target === shell || entry.target.contains(shell))
            .forEach((shell) => shell.classList.add("is-revealed"));
          imageObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8%", threshold: 0.08 },
    );
    [...new Set(imageShells.map((element) => element.parentElement || element))].forEach((element) =>
      imageObserver.observe(element),
    );

    const processObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const line = entry.target;
          const items = qsa(".process-line__item", line);
          line.style.setProperty("--process-progress", "1");
          items.forEach((item, index) => {
            window.setTimeout(() => item.classList.add("is-active"), index * 120);
          });
          processObserver.unobserve(line);
        });
      },
      { rootMargin: "0px 0px -18%", threshold: 0.2 },
    );
    processLines.forEach((line) => processObserver.observe(line));

    const footer = qs(".site-footer");
    if (footer) {
      const footerObserver = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          footer.classList.add("is-revealed");
          footerObserver.disconnect();
        },
        { rootMargin: "0px 0px -4%", threshold: 0.08 },
      );
      footerObserver.observe(footer);
    }
  } else {
    imageShells.forEach((element) => element.classList.add("is-revealed"));
    qs(".site-footer")?.classList.add("is-revealed");
  }

  if (window.matchMedia("(min-width: 761px)").matches) {
    let scrollFrame = 0;
    const updateParallax = () => {
      scrollFrame = 0;
      const offset = Math.max(-28, Math.min(28, window.scrollY * 0.025));
      qsa(".hero-media, .service-hero__media").forEach((image) =>
        image.style.setProperty("--motion-image-y", `${offset}px`),
      );
    };
    const scheduleParallax = () => {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateParallax);
    };
    updateParallax();
    window.addEventListener("scroll", scheduleParallax, { passive: true });
  }

  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const interactiveCards = qsa(
    ".home-service-card, .service-card--premium, .package, .promise-grid article, .price-factor-strip article, .contact-surface, .contact-channel",
  );
  interactiveCards.forEach((card) => {
    let pointerFrame = 0;
    let pointerX = 0;
    let pointerY = 0;
    card.classList.add("motion-spotlight");
    card.addEventListener(
      "pointermove",
      (event) => {
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (pointerFrame) return;
        pointerFrame = window.requestAnimationFrame(() => {
          pointerFrame = 0;
          const rect = card.getBoundingClientRect();
          const x = pointerX - rect.left;
          const y = pointerY - rect.top;
          card.style.setProperty("--spot-x", `${x}px`);
          card.style.setProperty("--spot-y", `${y}px`);
          if (card.matches(".service-card--premium, .package, .contact-surface")) {
            card.style.setProperty("--tilt-x", `${((y / rect.height - 0.5) * -2).toFixed(2)}deg`);
            card.style.setProperty("--tilt-y", `${((x / rect.width - 0.5) * 2).toFixed(2)}deg`);
          }
        });
      },
      { passive: true },
    );
    card.addEventListener("pointerleave", () => {
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
    });
  });

  qsa(".button--primary").forEach((button) => {
    let pointerFrame = 0;
    let pointerX = 0;
    let pointerY = 0;
    button.classList.add("motion-magnetic");
    button.addEventListener(
      "pointermove",
      (event) => {
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (pointerFrame) return;
        pointerFrame = window.requestAnimationFrame(() => {
          pointerFrame = 0;
          const rect = button.getBoundingClientRect();
          button.style.setProperty("--magnet-x", `${((pointerX - rect.left) / rect.width - 0.5) * 6}px`);
          button.style.setProperty("--magnet-y", `${((pointerY - rect.top) / rect.height - 0.5) * 4}px`);
        });
      },
      { passive: true },
    );
    button.addEventListener("pointerleave", () => {
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      button.style.setProperty("--magnet-x", "0px");
      button.style.setProperty("--magnet-y", "0px");
    });
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
    const isServiceArea =
      href === "/leistungen.html" && (currentPath === "/leistungen.html" || SERVICE_PAGE_SLUGS[currentPath]);
    const isCurrent = href === currentPath || isServiceArea;
    if (isCurrent) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  panel.insertAdjacentHTML(
    "beforeend",
    `
    <div class="nav-menu-meta">
      <p>Direkter Kontakt</p>
      <a data-whatsapp-link href="#" target="_blank" rel="noopener"><span>WhatsApp</span><strong>Fotos & Anfrage senden</strong></a>
      <a data-call-link href="#"><span>Telefon</span><strong data-phone></strong></a>
    </div>
  `,
  );

  const backdrop = document.createElement("div");
  backdrop.className = "nav-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  document.body.append(backdrop);
  let focusTimer;
  const background = qsa("main, .site-footer, .mobile-sticky-actions");
  const focusableLinks = () => qsa('a[href]:not([aria-disabled="true"]):not([tabindex="-1"])', panel);

  const close = (restoreFocus = false) => {
    window.clearTimeout(focusTimer);
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Menü öffnen");
    toggle.classList.remove("is-open");
    panel.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    document.body.classList.remove("nav-open");
    background.forEach((element) => {
      element.inert = false;
    });
    if (restoreFocus) toggle.focus();
  };

  const open = () => {
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Menü schließen");
    toggle.classList.add("is-open");
    panel.classList.add("is-open");
    backdrop.classList.add("is-open");
    document.body.classList.add("nav-open");
    background.forEach((element) => {
      element.inert = true;
    });
    focusTimer = window.setTimeout(() => focusableLinks()[0]?.focus(), 180);
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
    const focusable = [toggle, ...focusableLinks()];
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
  if (!serviceSelect.options?.length)
    serviceSelect.innerHTML = `<option value="">Bitte wählen</option>${activeServices()
      .map((service) => `<option value="${escapeHtml(service.title)}">${escapeHtml(service.title)}</option>`)
      .join("")}`;
  const requestedService = new URLSearchParams(window.location.search).get("service");
  const matchingService = activeServices().find(
    (service) => service.slug === requestedService || service.title === requestedService,
  );
  if (matchingService) serviceSelect.value = matchingService.title;
  const requestedPackage = new URLSearchParams(window.location.search).get("paket");
  const matchingPackage =
    siteConfig.packagesEnabled === true && siteConfig.packages.find((item) => item.name === requestedPackage);
  const message = qs('[name="message"]', form);
  if (matchingPackage && message && !message.value)
    message.value = `Ich interessiere mich für das Pflegepaket ${matchingPackage.name}.`;

  const setStatus = (message, type = "") => {
    status.textContent = message;
    status.classList.toggle("is-success", type === "success");
    status.classList.toggle("is-error", type === "error");
  };

  let submitting = false;
  const readyButton = qs('button[type="submit"]', form);
  const phoneField = qs('[name="phone"]', form);
  phoneField?.addEventListener("input", () => phoneField.setCustomValidity(""));
  if (readyButton) readyButton.disabled = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (phoneField && !window.AutoBusiness.validInquiryPhone(phoneField.value)) {
      phoneField.setCustomValidity("Bitte geben Sie eine Telefonnummer mit mindestens fünf Ziffern ein.");
      phoneField.reportValidity();
      return;
    }
    submitting = true;
    const data = Object.fromEntries(new FormData(form).entries());
    const submitButton = qs('button[type="submit"]', form);
    setStatus("Anfrage wird gesendet...");
    submitButton.disabled = true;
    form.setAttribute("aria-busy", "true");
    try {
      const response = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(90000),
      });
      const result = await response.json().catch(() => null);
      if (!result)
        throw new Error(
          "Der Versand konnte nicht bestätigt werden. Bitte versuchen Sie es später erneut. Ihre Eingaben bleiben erhalten.",
        );
      if (!response.ok || !result.success || !result.emailSent) {
        throw new Error(
          result.error ||
            "Der E-Mail-Versand konnte nicht bestätigt werden. Ihre Eingaben bleiben im Formular. Bitte versuchen Sie es später erneut.",
        );
      }
      setStatus("Vielen Dank. Ihre Anfrage wurde per E-Mail übermittelt.", "success");
      form.reset();
    } catch (error) {
      const message =
        error.name === "TimeoutError" || error.name === "AbortError"
          ? "Die Verbindung dauert zu lange. Der Versand konnte nicht bestätigt werden. Ihre Eingaben bleiben erhalten."
          : error instanceof TypeError
            ? "Die Verbindung wurde unterbrochen. Bitte prüfen Sie Ihre Internetverbindung. Ihre Eingaben bleiben erhalten."
            : error.message;
      setStatus(message, "error");
    } finally {
      submitting = false;
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
    if (copy)
      copy.textContent =
        "Die genaue Adresse wird noch ergänzt. Fragen zur Anfahrt können Sie uns über das Formular senden.";
    return;
  }
  let loading = false;
  let timer;
  const clear = () => {
    loading = false;
    window.clearTimeout(timer);
    frame.removeEventListener("load", loaded);
    frame.removeEventListener("error", failed);
    shell.removeAttribute("aria-busy");
    button.disabled = false;
  };
  const loaded = () => {
    if (!loading) return;
    clear();
    consent.hidden = true;
    shell.classList.add("is-loaded");
  };
  const failed = () => {
    if (!loading) return;
    clear();
    frame.hidden = true;
    frame.removeAttribute("src");
    if (copy)
      copy.textContent =
        "Die Karte konnte nicht geladen werden. Versuchen Sie es erneut oder nutzen Sie Route planen.";
    button.textContent = "Erneut versuchen";
  };
  button.addEventListener("click", () => {
    if (loading) return;
    loading = true;
    button.disabled = true;
    button.textContent = "Karte wird geladen…";
    shell.setAttribute("aria-busy", "true");
    frame.addEventListener("load", loaded);
    frame.addEventListener("error", failed);
    timer = window.setTimeout(failed, 15000);
    frame.src = window.AutoBusiness.contactLinks(siteConfig).map;
    frame.hidden = false;
  });
}

function initImageFallbacks() {
  const failed = (image) => {
    if (!(image instanceof HTMLImageElement) || image.dataset.fallback) return;
    image.dataset.fallback = "true";
    image.removeAttribute("srcset");
    image.alt = "Fahrzeugdarstellung";
    image.src = "/images/premium-hero.webp";
  };
  document.addEventListener("error", (event) => failed(event.target), true);
  qsa("img")
    .filter((image) => image.complete && image.naturalWidth === 0)
    .forEach(failed);
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
    <a class="button button--primary" data-whatsapp-link href="#" target="_blank" rel="noopener">
      <span data-service-icon="message-circle" aria-hidden="true"></span><span>WhatsApp<small></small></span>
    </a>
    <a class="button button--dark" data-call-link href="#">
      <span data-service-icon="phone" aria-hidden="true"></span><span>Anrufen<small></small></span>
    </a>`;
  const updateKeyboardState = () => {
    sticky.classList.toggle(
      "is-suppressed",
      Boolean(document.activeElement?.matches("input, textarea, select")),
    );
  };
  document.addEventListener("focusin", updateKeyboardState);
  document.addEventListener("focusout", () => window.setTimeout(updateKeyboardState, 0));
}

async function init() {
  loadConfig();
  initImageFallbacks();
  initStickyActions();
  initNav();
  initMotion();
  initPremiumMotion();
  applyGlobalConfig();
  initContactMap();
  initInquiryForm();
  initServiceDeepLinks();
  await hydrateServiceIcons();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(() => {
    console.error("Die Website konnte nicht vollständig geladen werden.");
    let fallback = qs("[data-app-error]");
    if (!fallback) {
      fallback = document.createElement("p");
      fallback.className = "app-notice";
      fallback.setAttribute("role", "alert");
      qs("main")?.prepend(fallback);
    }
    fallback.textContent = "Einige Inhalte konnten nicht geladen werden. Bitte laden Sie die Seite erneut.";
    const submitButton = qs('#inquiry-form button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
  });
});
