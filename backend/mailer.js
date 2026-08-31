const nodemailer = require("nodemailer");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function usableAddress(value) {
  return /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(value)
    && !/@(?:.*\.)?example\.(?:com|org|net|de)$/i.test(value)
    && !/\.(?:example|invalid|test)$/i.test(value);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    requireTLS: true,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    logger: false,
    debug: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendInquiryEmail(inquiry, siteConfig) {
  const transport = process.env.MAIL_TRANSPORT || "smtp";
  const recipient = (process.env.INQUIRY_RECIPIENT || siteConfig.email || "").trim();
  const fromEmail = (process.env.MAIL_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || "").trim();
  const credentialsReady = transport === "resend"
    ? Boolean(process.env.RESEND_API_KEY)
    : transport === "smtp" && Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  if (!credentialsReady || !usableAddress(recipient) || !usableAddress(fromEmail)) {
    return { sent: false, reason: "not_configured" };
  }

  const fromName = (process.env.MAIL_FROM_NAME || process.env.SMTP_FROM_NAME || `${siteConfig.siteName} Website`).replace(/[\r\n<>"]/g, " ").slice(0, 90);
  const subject = `Neue Website-Anfrage: ${inquiry.service || "Autoaufbereitung"}`.replace(/[\r\n]/g, " ");
  const replyTo = inquiry.email || undefined;
  const rows = [
    ["Name", inquiry.name],
    ["Telefon", inquiry.phone],
    ["E-Mail", inquiry.email || "Nicht angegeben"],
    ["Fahrzeug / Modell", inquiry.vehicle || "Nicht angegeben"],
    ["Leistung", inquiry.service || "Nicht angegeben"],
    ["Bevorzugter Kontakt", inquiry.preferredContact || "Keine Präferenz"],
    ["Nachricht", inquiry.message || "Keine Nachricht"],
    ["Eingang", new Date(inquiry.createdAt).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })],
    ["Anfrage-ID", inquiry.id]
  ];

  const message = {
    from: { name: fromName, address: fromEmail },
    to: recipient,
    replyTo,
    subject,
    text: rows.map(([label, value]) => `${label}: ${value}`).join("\n\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#171b1d">
        <h1 style="font-size:24px">Neue Anfrage über die Website</h1>
        <table style="width:100%;border-collapse:collapse">
          ${rows.map(([label, value]) => `
            <tr>
              <th style="padding:10px;text-align:left;vertical-align:top;border-bottom:1px solid #ddd">${escapeHtml(label)}</th>
              <td style="padding:10px;border-bottom:1px solid #ddd;white-space:pre-wrap">${escapeHtml(value)}</td>
            </tr>
          `).join("")}
        </table>
        ${replyTo ? `<p style="margin-top:24px">Auf diese E-Mail kann direkt geantwortet werden.</p>` : ""}
      </div>
    `
  };

  if (transport === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": inquiry.id
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [recipient],
        reply_to: replyTo,
        subject,
        text: message.text,
        html: message.html
      })
    });
    if (!response.ok) return { sent: false, reason: "delivery_failed" };
    const result = await response.json();
    return { sent: Boolean(result.id), reason: result.id ? "sent" : "delivery_failed" };
  }

  const result = await createTransporter().sendMail(message);
  const sent = result.accepted?.some((address) => String(address).toLowerCase() === recipient.toLowerCase());
  return { sent: Boolean(sent), reason: sent ? "sent" : "delivery_failed" };
}

module.exports = { sendInquiryEmail };
