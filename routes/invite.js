const express = require('express');
const router = express.Router();
const InvitationLink = require('../models/InvitationLink');
const Event = require('../models/Event');
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

  res.render('invite', {
    token,
    error: null,
    eventData: null
  });
});

// ========================================
// Ruta pública: procesar creación de evento (POST)
// ========================================
router.post('/:token', (req, res) => {
  const { token } = req.params;
  const { title, description, start, end, allDay } = req.body;

  const link = InvitationLink.findByToken(token);
  if (!link) {
    return res.status(400).send('Enlace inválido o expirado. Por favor, solicita un nuevo enlace al anfitrión.');
  }

  const userId = link.user_id;

  // Validaciones
  if (!title || !start || !end) {
    return res.render('invite', {
      token,
      error: 'Título, inicio y fin son obligatorios.',
      eventData: { title, description, start, end, allDay }
    });
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.render('invite', {
      token,
      error: 'Formato de fecha inválido.',
      eventData: { title, description, start, end, allDay }
    });
  }

  const now = new Date();
  if (startDate < now) {
    return res.render('invite', {
      token,
      error: 'No se pueden crear eventos en el pasado. Por favor, elige una fecha y hora futura.',
      eventData: { title, description, start, end, allDay }
    });
  }

  if (endDate <= startDate) {
    return res.render('invite', {
      token,
      error: 'La fecha de fin debe ser posterior a la de inicio.',
      eventData: { title, description, start, end, allDay }
    });
  }

  // Validar solapamiento
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
      eventData: { title, description, start, end, allDay }
    });
  }

  // Crear evento
  try {
    const allDayFlag = allDay === 'true' || allDay === true;
    const eventId = Event.create({
      userId,
      title,
      description,
      start: startISO,
      end: endISO,
      allDay: allDayFlag,
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
