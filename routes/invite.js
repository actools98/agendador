const express = require('express');
const router = express.Router();
const InvitationLink = require('../models/InvitationLink');
const Event = require('../models/Event');
const Preferencia = require('../models/Preferencia');
const db = require('../db');

// ========================================
// Ruta pública: formulario para crear evento (GET)
// ========================================
router.get('/:token', (req, res) => {
  const { token } = req.params;
  const link = InvitationLink.findByToken(token);
  if (!link) {
    return res.status(400).send('Enlace inválido o expirado. Por favor, solicita un nuevo enlace al anfitrión.');
  }

  const userId = link.user_id;
  const pref = Preferencia.getByUser(userId) || {
    work_start: 480,
    work_end: 1020,
    work_days: '1,2,3,4,5',
    meeting_duration: 60,
    contact_phone: '',
    meeting_address: ''
  };

  res.render('invite', {
    token,
    error: null,
    eventData: null,
    workStart: pref.work_start,
    workEnd: pref.work_end,
    workDays: pref.work_days,
    meetingDuration: pref.meeting_duration
  });
});

// ========================================
// Ruta pública: procesar creación de evento (POST)
// ========================================
router.post('/:token', (req, res) => {
  const { token } = req.params;
  const { title, description, start, timezoneOffset } = req.body;

  const link = InvitationLink.findByToken(token);
  if (!link) {
    return res.status(400).send('Enlace inválido o expirado. Por favor, solicita un nuevo enlace al anfitrión.');
  }

  const userId = link.user_id;
  const pref = Preferencia.getByUser(userId) || {
    work_start: 480,
    work_end: 1020,
    work_days: '1,2,3,4,5',
    meeting_duration: 60,
    contact_phone: '',
    meeting_address: ''
  };

  if (!title || !start || timezoneOffset === undefined) {
    return res.render('invite', {
      token,
      error: 'Título y fecha/hora de inicio son obligatorios.',
      eventData: { title, description, start },
      workStart: pref.work_start,
      workEnd: pref.work_end,
      workDays: pref.work_days,
      meetingDuration: pref.meeting_duration
    });
  }

  // ========== PARSEO MANUAL DE FECHA ==========
  const [datePart, timePart] = start.split('T');
  if (!datePart || !timePart) {
    return res.render('invite', {
      token,
      error: 'Formato de fecha inválido.',
      eventData: { title, description, start },
      workStart: pref.work_start,
      workEnd: pref.work_end,
      workDays: pref.work_days,
      meetingDuration: pref.meeting_duration
    });
  }
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  if ([year, month, day, hours, minutes].some(isNaN)) {
    return res.render('invite', {
      token,
      error: 'Formato de fecha inválido.',
      eventData: { title, description, start },
      workStart: pref.work_start,
      workEnd: pref.work_end,
      workDays: pref.work_days,
      meetingDuration: pref.meeting_duration
    });
  }

  // ========== CONSTRUIR FECHA LOCAL DEL USUARIO ==========
  const userDate = new Date(year, month - 1, day, hours, minutes);

  // ========== CALCULAR FECHA ACTUAL DEL USUARIO ==========
  const now = new Date();
  const serverOffsetMinutes = now.getTimezoneOffset();
  const userOffsetMinutes = parseInt(timezoneOffset);
  const diffMinutes = userOffsetMinutes - (-serverOffsetMinutes);
  const userNow = new Date(now.getTime() + diffMinutes * 60000);

  // ========== VALIDAR QUE NO SEA PASADO ==========
  if (userDate.getTime() < userNow.getTime()) {
    return res.render('invite', {
      token,
      error: 'No se pueden crear eventos en el pasado. Por favor, elige una fecha y hora futura.',
      eventData: { title, description, start },
      workStart: pref.work_start,
      workEnd: pref.work_end,
      workDays: pref.work_days,
      meetingDuration: pref.meeting_duration
    });
  }

  // ========== VALIDAR DÍA DE LA SEMANA ==========
  const dayOfWeek = userDate.getDay();
  let ourDay = dayOfWeek === 0 ? 7 : dayOfWeek;
  const allowedDays = pref.work_days.split(',').map(Number);
  if (!allowedDays.includes(ourDay)) {
    return res.render('invite', {
      token,
      error: 'El día seleccionado no está disponible. Por favor, elige otro día.',
      eventData: { title, description, start },
      workStart: pref.work_start,
      workEnd: pref.work_end,
      workDays: pref.work_days,
      meetingDuration: pref.meeting_duration
    });
  }

  // ========== VALIDAR HORA DENTRO DE LA FRANJA ==========
  const minutesFromMidnight = hours * 60 + minutes;
  if (minutesFromMidnight < pref.work_start || minutesFromMidnight >= pref.work_end) {
    return res.render('invite', {
      token,
      error: 'La hora seleccionada está fuera de la franja horaria disponible.',
      eventData: { title, description, start },
      workStart: pref.work_start,
      workEnd: pref.work_end,
      workDays: pref.work_days,
      meetingDuration: pref.meeting_duration
    });
  }

  // ========== CALCULAR FIN ==========
  const endMinutes = minutesFromMidnight + pref.meeting_duration;
  if (endMinutes > pref.work_end) {
    return res.render('invite', {
      token,
      error: 'La reunión excede la franja horaria disponible. Por favor, elige una hora más temprana.',
      eventData: { title, description, start },
      workStart: pref.work_start,
      workEnd: pref.work_end,
      workDays: pref.work_days,
      meetingDuration: pref.meeting_duration
    });
  }

  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;
  const pad = n => String(n).padStart(2, '0');
  const startStr = `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:00`;
  const endStr = `${year}-${pad(month)}-${pad(day)} ${pad(endHours)}:${pad(endMins)}:00`;

  // ========== VALIDAR SOLAPAMIENTO ==========
  const conflictStmt = db.prepare(`
    SELECT COUNT(*) as count FROM events
    WHERE user_id = ?
      AND status = 'active'
      AND (
        (start < ? AND end > ?)
        OR (start >= ? AND start < ?)
        OR (end > ? AND end <= ?)
      )
  `);
  const result = conflictStmt.get(userId, endStr, startStr, startStr, endStr, startStr, endStr);

  if (result.count > 0) {
    return res.render('invite', {
      token,
      error: 'La franja horaria seleccionada coincide con otro evento existente. Por favor, elige otro horario.',
      eventData: { title, description, start },
      workStart: pref.work_start,
      workEnd: pref.work_end,
      workDays: pref.work_days,
      meetingDuration: pref.meeting_duration
    });
  }

  // ========== CREAR EVENTO ==========
  try {
    const eventId = Event.create({
      userId,
      title,
      description,
      start: startStr,
      end: endStr,
      allDay: false,
      color: '#ffc107',
      status: 'active',
      categoria_id: null,
      link: null,
      address: null
    });

    const contactPhone = pref.contact_phone || '';
    const meetingAddress = pref.meeting_address || '';

    // ====== MENSAJE DE ÉXITO (SIN MAPA) ======
    let successHTML = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Evento creado</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      </head>
      <body class="bg-light d-flex align-items-center justify-content-center vh-100">
        <div class="card text-center p-5 shadow" style="max-width:550px;">
          <h2 class="text-success">✅ Evento creado</h2>
          <p>Tu evento "<strong>${title}</strong>" ha sido agendado exitosamente.</p>
          <p class="text-muted">El anfitrión recibirá la notificación.</p>
    `;

    if (meetingAddress) {
      successHTML += `
        <div class="mt-3">
          <p><strong>Te esperamos en:</strong></p>
          <p>${meetingAddress}</p>
        </div>
      `;
    }

    if (contactPhone) {
      successHTML += `
        <div class="mt-3">
          <p><strong>Para cancelaciones comunicarse con:</strong><br>${contactPhone}</p>
        </div>
      `;
    }

    successHTML += `
        </div>
      </body>
      </html>
    `;

    res.send(successHTML);
  } catch (error) {
    console.error('Error al crear evento por invitación:', error);
    res.status(500).send('Error interno al crear el evento.');
  }
});

module.exports = router;
