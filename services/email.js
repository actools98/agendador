const nodemailer = require('nodemailer');

let transporter = null;

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (transporter) return transporter;
  if (!isConfigured()) return null;

  const port = parseInt(process.env.SMTP_PORT || '587');
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // true para 465, false para 587/25
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  if (!to || !to.trim()) {
    console.log('[email] Sin destinatario, se omite envío.');
    return { skipped: true };
  }
  const t = getTransporter();
  if (!t) {
    console.log('[email] SMTP no configurado. No se envía correo a:', to);
    return { skipped: true };
  }
  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text
    });
    console.log('[email] Enviado a', to, '- messageId:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[email] Error enviando a', to, '-', err.message);
    return { success: false, error: err.message };
  }
}

// Utilidad interna para dar formato a la fecha en español
function formatDateEs(date) {
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function formatTimeEs(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Envoltorio HTML común para ambos correos
function wrapHtml({ title, accent = '#3788d8', bodyHtml }) {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#212529;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:${accent};padding:20px 28px;">
              <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;font-size:15px;line-height:1.55;color:#212529;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background:#f8f9fa;padding:14px 28px;font-size:12px;color:#6c757d;text-align:center;">
              Este correo fue enviado automáticamente. Por favor, no respondas a este mensaje.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

// Escapa HTML para evitar inyección en los correos
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendBookingToHost({ hostEmail, hostUsername, guestEmail, eventTitle, eventDescription, startDate, endDate }) {
  const dateStr = formatDateEs(startDate);
  const startTime = formatTimeEs(startDate);
  const endTime = formatTimeEs(endDate);

  const body = `
    <p>Hola <strong>${esc(hostUsername)}</strong>,</p>
    <p>Alguien ha agendado una cita en tu calendario a través de tu enlace de invitación.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8f9fa;border-radius:8px;margin:16px 0;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0 0 8px;"><strong>📌 Evento:</strong> ${esc(eventTitle)}</p>
        ${eventDescription ? `<p style="margin:0 0 8px;"><strong>📝 Descripción:</strong> ${esc(eventDescription)}</p>` : ''}
        <p style="margin:0 0 8px;"><strong>📅 Fecha:</strong> ${esc(dateStr)}</p>
        <p style="margin:0 0 8px;"><strong>⏰ Hora:</strong> ${esc(startTime)} – ${esc(endTime)}</p>
        ${guestEmail ? `<p style="margin:0;"><strong>✉️ Email del invitado:</strong> <a href="mailto:${esc(guestEmail)}" style="color:${'#3788d8'};">${esc(guestEmail)}</a></p>` : '<p style="margin:0;color:#6c757d;"><em>El invitado no dejó un email de contacto.</em></p>'}
      </td></tr>
    </table>

    <p>Puedes ver los detalles completos en tu calendario, en la sección <strong>"Mis eventos activos"</strong>.</p>
  `;

  return sendMail({
    to: hostEmail,
    subject: `📅 Nueva reserva: ${eventTitle} — ${dateStr} ${startTime}`,
    html: wrapHtml({ title: 'Nueva reserva en tu calendario', accent: '#3788d8', bodyHtml: body }),
    text: `Nueva reserva en tu calendario.\n\nEvento: ${eventTitle}\nFecha: ${dateStr}\nHora: ${startTime} - ${endTime}\n${guestEmail ? `Email del invitado: ${guestEmail}` : 'El invitado no dejó email.'}`
  });
}

async function sendBookingToGuest({ guestEmail, hostUsername, eventTitle, eventDescription, startDate, endDate, meetingAddress, contactPhone }) {
  const dateStr = formatDateEs(startDate);
  const startTime = formatTimeEs(startDate);
  const endTime = formatTimeEs(endDate);

  const body = `
    <p>Hola,</p>
    <p>Tu cita con <strong>${esc(hostUsername)}</strong> ha sido confirmada. A continuación encuentras todos los detalles:</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8f9fa;border-radius:8px;margin:16px 0;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0 0 8px;"><strong>📌 Evento:</strong> ${esc(eventTitle)}</p>
        ${eventDescription ? `<p style="margin:0 0 8px;"><strong>📝 Descripción:</strong> ${esc(eventDescription)}</p>` : ''}
        <p style="margin:0 0 8px;"><strong>📅 Fecha:</strong> ${esc(dateStr)}</p>
        <p style="margin:0 0 8px;"><strong>⏰ Hora:</strong> ${esc(startTime)} – ${esc(endTime)}</p>
        ${meetingAddress ? `<p style="margin:0 0 8px;"><strong>📍 Dirección:</strong> ${esc(meetingAddress)}</p>` : ''}
        ${contactPhone ? `<p style="margin:0;"><strong>📞 Contacto:</strong> ${esc(contactPhone)}</p>` : ''}
      </td></tr>
    </table>

    <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px 16px;border-radius:6px;margin:16px 0;">
      <p style="margin:0;font-size:14px;">
        <strong>⏱️ Recomendación:</strong> te sugerimos presentarte <strong>10 minutos antes</strong> de la hora acordada para aprovechar al máximo el tiempo de la reunión.
      </p>
    </div>

    ${contactPhone ? `<p>Si necesitas reprogramar o cancelar, por favor comunícate al <strong>${esc(contactPhone)}</strong>.</p>` : ''}

    <p>¡Te esperamos!</p>
  `;

  return sendMail({
    to: guestEmail,
    subject: `✅ Tu cita ha sido agendada — ${dateStr} ${startTime}`,
    html: wrapHtml({ title: 'Tu cita ha sido agendada', accent: '#28a745', bodyHtml: body }),
    text: `Tu cita ha sido agendada.\n\nEvento: ${eventTitle}\nFecha: ${dateStr}\nHora: ${startTime} - ${endTime}\n${meetingAddress ? `Dirección: ${meetingAddress}\n` : ''}${contactPhone ? `Contacto: ${contactPhone}\n` : ''}\nRecomendación: llegar 10 minutos antes.`
  });
}

module.exports = {
  isConfigured,
  sendMail,
  sendBookingToHost,
  sendBookingToGuest
};
