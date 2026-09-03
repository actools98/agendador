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
  // Obtener preferencias del usuario
  const pref = Preferencia.getByUser(userId) || {
    work_start: 480,
    work_end: 1020,
    work_days: '1,2,3,4,5',
    meeting_duration: 60
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
  const { title, description, start } = req.body;

  const link = InvitationLink.findByToken(token);
  if (!link) {
    return res.status(400).send('Enlace inválido o expirado. Por favor, solicita un nuevo enlace al anfitrión.');
  }

  const userId = link.user_id;

  // Validar campos obligatorios
  if (!title || !start) {
    return res.render('invite', {
      token,
      error: 'Título y fecha/hora de inicio son obligatorios.',
      eventData: { title, description, start },
      workStart: 480,
      workEnd: 1020,
      workDays: '1,2,3,4,5',
      meetingDuration: 60
    });
  }

  const startDate = new Date(start);
  if (isNaN(startDate.getTime())) {
    return res.render('invite', {
      token,
      error: 'Formato de fecha inválido.',
      eventData: { title, description, start },
      workStart: 480,
      workEnd: 1020,
      workDays: '1,2,3,4,5',
      meetingDuration: 60
    });
  }

  // Obtener preferencias del usuario
  const pref = Preferencia.getByUser(userId) || {
    work_start: 480,
    work_end: 1020,
    work_days: '1,2,3,4,5',
    meeting_duration: 60
  };

  // Validar día de la semana
  const dayOfWeek = startDate.getDay(); // 0=domingo, 1=lunes...
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

  // Validar hora dentro de la franja
  const minutes = startDate.getHours() * 60 + startDate.getMinutes();
  if (minutes < pref.work_start || minutes >= pref.work_end) {
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

  // Calcular fin = inicio + duración
  const endDate = new Date(startDate.getTime() + pref.meeting_duration * 60000);

  // Validar que el fin no se salga de la franja horaria
  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
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

  // Validar que no sea en el pasado
  const now = new Date();
  if (startDate < now) {
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

  // Validar solapamiento con eventos existentes
  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

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
  const result = conflictStmt.get(userId, endISO, startISO, startISO, endISO, startISO, endISO);

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

  // Crear evento
  try {
    const eventId = Event.create({
      userId,
      title,
      description,
      start: startISO,
      end: endISO,
      allDay: false, // nunca todo el día
      color: '#ffc107',
      status: 'active',
      categoria_id: null,
      link: null,
      address: null
    });

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Evento creado</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      </head>
      <body class="bg-light d-flex align-items-center justify-content-center vh-100">
        <div class="card text-center p-5 shadow" style="max-width:500px;">
          <h2 class="text-success">✅ Evento creado</h2>
          <p>Tu evento "<strong>${title}</strong>" ha sido agendado exitosamente.</p>
          <p class="text-muted">El anfitrión recibirá la notificación.</p>
          <a href="/" class="btn btn-primary mt-3">Volver al inicio</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error al crear evento por invitación:', error);
    res.status(500).send('Error interno al crear el evento.');
  }
});

module.exports = router;
