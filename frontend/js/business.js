(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AutoBusiness = factory();
})(typeof window === "object" ? window : this, function () {
  const hasPlaceholder = (value) => !String(value || "").trim() || /\[[^\]]+\]/.test(String(value));
  const cleanPhone = (value) => String(value || "").replace(/[^\d+]/g, "");
  const validInquiryPhone = (value) =>
    /^[+\d\s().\/-]+$/.test(String(value || "")) && String(value || "").replace(/\D/g, "").length >= 5;
  function hasUsablePhone(value) {
    const phone = cleanPhone(value);
    return (
      /^[+\d\s().\/-]+$/.test(String(value || "")) &&
      /^\+?\d{6,15}$/.test(phone) &&
      /[1-9]/.test(phone.replace(/^\+?49/, ""))
    );
  }
  function hasUsableWhatsapp(value) {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        url.hostname === "wa.me" &&
        !url.port &&
        !url.username &&
        !url.password &&
        /^\/\d+$/.test(url.pathname) &&
        hasUsablePhone(url.pathname.slice(1))
      );
    } catch {
      return false;
    }
  }
  function whatsappUrl(value, message) {
    if (!hasUsableWhatsapp(value)) return "";
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    url.searchParams.set("text", message);
    return url.href;
  }
  function hasUsableEmail(value) {
    const email = String(value || "").trim();
    return (
      !hasPlaceholder(email) &&
      /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(email) &&
      !/@(?:.*\.)?example\.(?:com|org|net|de)$/i.test(email) &&
      !/\.(?:example|invalid|test)$/i.test(email)
    );
  }
  function hasUsableAddress(address) {
    return Boolean(
      address && [address.street, address.zip, address.city].every((value) => !hasPlaceholder(value)),
    );
  }
  function coordinates(address) {
    const { latitude, longitude } = address || {};
    return typeof latitude === "number" &&
      typeof longitude === "number" &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
      ? `${latitude},${longitude}`
      : "";
  }
  const addressText = (address = {}) => `${address.street || ""}, ${address.zip || ""} ${address.city || ""}`;
  function mapDestination(address) {
    return coordinates(address) || (hasUsableAddress(address) ? addressText(address) : "");
  }
  function contactLinks(
    config,
    message = "Hallo, ich möchte ein Angebot für eine Autoaufbereitung anfragen.",
  ) {
    const destination = mapDestination(config.address);
    return {
      phone: hasUsablePhone(config.phone) ? `tel:${cleanPhone(config.phone)}` : "",
      email: hasUsableEmail(config.email) ? `mailto:${config.email.trim()}` : "",
      whatsapp: whatsappUrl(config.whatsapp, message),
      route: destination
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
        : "",
      map: destination ? `https://www.google.com/maps?q=${encodeURIComponent(destination)}&output=embed` : "",
    };
  }
  function safeHttps(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
    } catch {
      return "";
    }
  }
  return {
    hasPlaceholder,
    cleanPhone,
    validInquiryPhone,
    hasUsablePhone,
    hasUsableWhatsapp,
    whatsappUrl,
    hasUsableEmail,
    hasUsableAddress,
    addressText,
    coordinates,
    mapDestination,
    contactLinks,
    safeHttps,
  };
});
