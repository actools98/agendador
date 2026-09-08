const express = require('express');
const router = express.Router();
const InvitationLink = require('../models/InvitationLink');
const Event = require('../models/Event');
const Preferencia = require('../models/Preferencia');
const AvailabilityBlock = require('../models/AvailabilityBlock');
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
    meeting_duration: 60,
    contact_phone: '',
    meeting_address: ''
  };
  const blocks = AvailabilityBlock.findByUser(userId);

  // Agrupar bloques por día
  const blocksByDay = {};
  for (let i = 1; i <= 7; i++) {
    blocksByDay[i] = blocks.filter(b => b.day_of_week === i);
  }

  res.render('invite', {
    token,
    error: null,
    eventData: null,
    meetingDuration: pref.meeting_duration,
    contactPhone: pref.contact_phone || '',
    meetingAddress: pref.meeting_address || '',
    blocksByDay: blocksByDay
  });
});

// ========================================
// Ruta pública: procesar creación de evento (POST)
// ========================================
router.post('/:token', (req, res) => {
  const { token } = req.params;
  const { title, description, date, blockId } = req.body;

  const link = InvitationLink.findByToken(token);
  if (!link) {
    return res.status(400).send('Enlace inválido o expirado. Por favor, solicita un nuevo enlace al anfitrión.');
  }

  const userId = link.user_id;
  const pref = Preferencia.getByUser(userId) || {
    meeting_duration: 60,
    contact_phone: '',
    meeting_address: ''
  };

  // Validaciones básicas
  if (!title || !date || !blockId) {
    return res.render('invite', {
      token,
      error: 'Título, fecha y bloque son obligatorios.',
      eventData: { title, description, date, blockId },
      meetingDuration: pref.meeting_duration,
      contactPhone: pref.contact_phone || '',
      meetingAddress: pref.meeting_address || '',
      blocksByDay: AvailabilityBlock.findByUser(userId).reduce((acc, b) => {
        if (!acc[b.day_of_week]) acc[b.day_of_week] = [];
        acc[b.day_of_week].push(b);
        return acc;
      }, {})
    });
  }

  // Obtener el bloque seleccionado
  const block = AvailabilityBlock.findByUser(userId).find(b => b.id === parseInt(blockId));
  if (!block) {
    return res.render('invite', {
      token,
      error: 'El bloque seleccionado no es válido.',
      eventData: { title, description, date, blockId },
      meetingDuration: pref.meeting_duration,
      contactPhone: pref.contact_phone || '',
      meetingAddress: pref.meeting_address || '',
      blocksByDay: AvailabilityBlock.findByUser(userId).reduce((acc, b) => {
        if (!acc[b.day_of_week]) acc[b.day_of_week] = [];
        acc[b.day_of_week].push(b);
        return acc;
      }, {})
    });
  }

  // Validar que la fecha seleccionada corresponda al día de la semana del bloque
  const selectedDate = new Date(date + 'T00:00:00');
  const dayOfWeek = selectedDate.getDay(); // 0=domingo, 1=lunes...
  let ourDay = dayOfWeek === 0 ? 7 : dayOfWeek;
  if (block.day_of_week !== ourDay) {
    return res.render('invite', {
      token,
      error: 'El bloque seleccionado no corresponde al día de la fecha elegida.',
      eventData: { title, description, date, blockId },
      meetingDuration: pref.meeting_duration,
      contactPhone: pref.contact_phone || '',
      meetingAddress: pref.meeting_address || '',
      blocksByDay: AvailabilityBlock.findByUser(userId).reduce((acc, b) => {
        if (!acc[b.day_of_week]) acc[b.day_of_week] = [];
        acc[b.day_of_week].push(b);
        return acc;
      }, {})
    });
  }

  // ========== VALIDACIÓN CORREGIDA: BLOQUE PASADO ==========
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  if (date === todayStr) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    // El bloque está disponible si su fin es mayor que la hora actual
    if (block.end_minutes <= currentMinutes) {
      return res.render('invite', {
        token,
        error: 'Este bloque ya ha terminado para hoy. Por favor, selecciona otro día o bloque.',
        eventData: { title, description, date, blockId },
        meetingDuration: pref.meeting_duration,
        contactPhone: pref.contact_phone || '',
        meetingAddress: pref.meeting_address || '',
        blocksByDay: AvailabilityBlock.findByUser(userId).reduce((acc, b) => {
          if (!acc[b.day_of_week]) acc[b.day_of_week] = [];
          acc[b.day_of_week].push(b);
          return acc;
        }, {})
      });
    }
    // Verificar si la duración de la reunión cabe en el tiempo restante del bloque
    const remainingMinutes = block.end_minutes - currentMinutes;
    if (remainingMinutes < pref.meeting_duration) {
      return res.render('invite', {
        token,
        error: `El tiempo restante del bloque (${Math.floor(remainingMinutes/60)}h ${remainingMinutes%60}min) es insuficiente para la duración de la reunión (${Math.floor(pref.meeting_duration/60)}h ${pref.meeting_duration%60}min). Por favor, selecciona otro bloque.`,
        eventData: { title, description, date, blockId },
        meetingDuration: pref.meeting_duration,
        contactPhone: pref.contact_phone || '',
        meetingAddress: pref.meeting_address || '',
        blocksByDay: AvailabilityBlock.findByUser(userId).reduce((acc, b) => {
          if (!acc[b.day_of_week]) acc[b.day_of_week] = [];
          acc[b.day_of_week].push(b);
          return acc;
        }, {})
      });
    }
  }

  // Construir fechas de inicio y fin
  const startDate = new Date(date + 'T00:00:00');
  startDate.setHours(Math.floor(block.start_minutes / 60), block.start_minutes % 60, 0, 0);
  const endDate = new Date(startDate);
  endDate.setMinutes(endDate.getMinutes() + pref.meeting_duration);

  // Validar que el fin no exceda el bloque (por si acaso)
  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
  if (endMinutes > block.end_minutes) {
    return res.render('invite', {
      token,
      error: 'La duración de la reunión excede el bloque de disponibilidad. Por favor, elige otro bloque o reduce la duración.',
      eventData: { title, description, date, blockId },
      meetingDuration: pref.meeting_duration,
      contactPhone: pref.contact_phone || '',
      meetingAddress: pref.meeting_address || '',
      blocksByDay: AvailabilityBlock.findByUser(userId).reduce((acc, b) => {
        if (!acc[b.day_of_week]) acc[b.day_of_week] = [];
        acc[b.day_of_week].push(b);
        return acc;
      }, {})
    });
  }

  const pad = n => String(n).padStart(2, '0');
  const startStr = `${date} ${pad(startDate.getHours())}:${pad(startDate.getMinutes())}:00`;
  const endStr = `${date} ${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;

  // Validar solapamiento con eventos existentes
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
      error: 'La franja horaria seleccionada coincide con otro evento existente. Por favor, elige otro bloque.',
      eventData: { title, description, date, blockId },
      meetingDuration: pref.meeting_duration,
      contactPhone: pref.contact_phone || '',
      meetingAddress: pref.meeting_address || '',
      blocksByDay: AvailabilityBlock.findByUser(userId).reduce((acc, b) => {
        if (!acc[b.day_of_week]) acc[b.day_of_week] = [];
        acc[b.day_of_week].push(b);
        return acc;
      }, {})
    });
  }

  // Crear evento
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
