const nodemailer = require("nodemailer");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isMailConfigured() {
  return Boolean(
    process.env.SMTP_HOST
    && process.env.SMTP_USER
    && process.env.SMTP_PASS
    && process.env.SMTP_FROM_EMAIL
  );
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendInquiryEmail(inquiry, siteConfig) {
  if (!isMailConfigured()) {
    return { sent: false, reason: "not_configured" };
  }

  const recipient = process.env.INQUIRY_RECIPIENT || siteConfig.email;
  const fromName = process.env.SMTP_FROM_NAME || `${siteConfig.siteName} Website`;
  const subject = `Neue Website-Anfrage: ${inquiry.service || "Autoaufbereitung"}`;
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

  await createTransporter().sendMail({
    from: { name: fromName, address: process.env.SMTP_FROM_EMAIL },
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
  });

  return { sent: true };
}

module.exports = { sendInquiryEmail };
