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

  res.render('invite', {
    token,
    error: null,
    eventData: null,
    meetingDuration: pref.meeting_duration,
    contactPhone: pref.contact_phone || '',
    meetingAddress: pref.meeting_address || ''
  });
});

// ========================================
// Ruta pública: obtener bloques disponibles para una fecha (AJAX)
// ========================================
router.get('/availability/:token/:date', (req, res) => {
  const { token, date } = req.params;

  const link = InvitationLink.findByToken(token);
  if (!link) {
    return res.status(400).json({ error: 'Enlace inválido o expirado' });
  }

  const userId = link.user_id;
  const pref = Preferencia.getByUser(userId) || { meeting_duration: 60 };
  const meetingDuration = pref.meeting_duration;

  // Calcular el día de la semana de la fecha solicitada (1=lunes ... 7=domingo)
  const selectedDate = new Date(date + 'T00:00:00');
  if (isNaN(selectedDate.getTime())) {
    return res.status(400).json({ error: 'Fecha inválida' });
  }
  const jsDay = selectedDate.getDay(); // 0=domingo, 1=lunes...
  const ourDay = jsDay === 0 ? 7 : jsDay;

  // Obtener SOLO los bloques del día de la semana correspondiente
  const allBlocks = AvailabilityBlock.findByUserAndDay(userId, ourDay);

  // Obtener los eventos activos para esa fecha
  const startOfDay = date + ' 00:00:00';
  const endOfDay = date + ' 23:59:59';
  const eventsStmt = db.prepare(`
    SELECT * FROM events 
    WHERE user_id = ? 
      AND status = 'active'
      AND start >= ? AND start <= ?
  `);
  const events = eventsStmt.all(userId, startOfDay, endOfDay);

  // Verificar si un bloque está ocupado por algún evento
  const isBlockOccupied = (block) => {
    return events.some(event => {
      const eventStart = new Date(event.start.replace(' ', 'T'));
      const eventEnd = new Date(event.end.replace(' ', 'T'));
      const blockStart = new Date(date + 'T00:00:00');
      blockStart.setHours(Math.floor(block.start_minutes / 60), block.start_minutes % 60, 0, 0);
      const blockEnd = new Date(date + 'T00:00:00');
      blockEnd.setHours(Math.floor(block.end_minutes / 60), block.end_minutes % 60, 0, 0);
      return eventStart < blockEnd && eventEnd > blockStart;
    });
  };

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const availableBlocks = allBlocks.filter(block => {
    // Debe durar al menos meeting_duration
    const blockDuration = block.end_minutes - block.start_minutes;
    if (blockDuration < meetingDuration) return false;

    // Si es hoy, que aún no haya pasado y quede tiempo suficiente
    if (date === todayStr) {
      if (block.end_minutes <= currentMinutes) return false;
      const remaining = block.end_minutes - currentMinutes;
      if (remaining < meetingDuration) return false;
    }

    // No debe solaparse con un evento existente
    if (isBlockOccupied(block)) return false;

    return true;
  });

  res.json({ blocks: availableBlocks });
});

// ========================================
// Ruta pública: disponibilidad del mes completo (una sola petición)
// Devuelve { availableDates: { "YYYY-MM-DD": cantidadBloques } }
// ========================================
router.get('/availability-month/:token/:year/:month', (req, res) => {
  const { token } = req.params;
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month); // 0-11

  if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
    return res.status(400).json({ error: 'Año o mes inválido' });
  }

  const link = InvitationLink.findByToken(token);
  if (!link) {
    return res.status(400).json({ error: 'Enlace inválido o expirado' });
  }

  const userId = link.user_id;
  const pref = Preferencia.getByUser(userId) || { meeting_duration: 60 };
  const meetingDuration = pref.meeting_duration;

  // Bloques agrupados por día de la semana
  const allBlocks = AvailabilityBlock.findByUser(userId);
  const blocksByDay = {};
  for (const b of allBlocks) {
    if (!blocksByDay[b.day_of_week]) blocksByDay[b.day_of_week] = [];
    blocksByDay[b.day_of_week].push(b);
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Eventos activos del mes completo (una sola consulta)
  const monthStartStr = `${year}-${String(month + 1).padStart(2, '0')}-01 00:00:00`;
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const monthEndStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')} 23:59:59`;
  const eventsStmt = db.prepare(`
    SELECT start, end FROM events
    WHERE user_id = ? AND status = 'active'
      AND start <= ? AND end >= ?
  `);
  const monthEvents = eventsStmt.all(userId, monthEndStr, monthStartStr);

  const availableDates = {};
  const daysInMonth = lastDayOfMonth;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const dateMidnight = new Date(year, month, day, 0, 0, 0);
    if (dateMidnight < todayMidnight) continue;

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const jsDay = dateObj.getDay();
    const ourDay = jsDay === 0 ? 7 : jsDay;
    const dayBlocks = blocksByDay[ourDay] || [];
    if (dayBlocks.length === 0) continue;

    // Eventos que tocan ese día
    const dayStart = new Date(year, month, day, 0, 0, 0);
    const dayEnd = new Date(year, month, day, 23, 59, 59);
    const dayEvents = monthEvents.filter(ev => {
      const s = new Date(ev.start.replace(' ', 'T'));
      const e = new Date(ev.end.replace(' ', 'T'));
      return s <= dayEnd && e >= dayStart;
    });

    const available = dayBlocks.filter(block => {
      const blockDuration = block.end_minutes - block.start_minutes;
      if (blockDuration < meetingDuration) return false;

      if (dateStr === todayStr) {
        if (block.end_minutes <= currentMinutes) return false;
        if (block.end_minutes - currentMinutes < meetingDuration) return false;
      }

      const isOccupied = dayEvents.some(event => {
        const eventStart = new Date(event.start.replace(' ', 'T'));
        const eventEnd = new Date(event.end.replace(' ', 'T'));
        const blockStart = new Date(year, month, day, Math.floor(block.start_minutes / 60), block.start_minutes % 60, 0, 0);
        const blockEnd = new Date(year, month, day, Math.floor(block.end_minutes / 60), block.end_minutes % 60, 0, 0);
        return eventStart < blockEnd && eventEnd > blockStart;
      });

      return !isOccupied;
    });

    if (available.length > 0) {
      availableDates[dateStr] = available.length;
    }
  }

  res.json({ availableDates });
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

  // Helper local para re-renderizar el formulario con error
  const renderError = (errorMsg, eventData) => {
    const blocks = AvailabilityBlock.findByUser(userId);
    const blocksByDay = {};
    for (let i = 1; i <= 7; i++) {
      blocksByDay[i] = blocks.filter(b => b.day_of_week === i);
    }
    return res.render('invite', {
      token,
      error: errorMsg,
      eventData,
      meetingDuration: pref.meeting_duration,
      contactPhone: pref.contact_phone || '',
      meetingAddress: pref.meeting_address || '',
      blocksByDay
    });
  };

  // Validaciones básicas
  if (!title || !date || !blockId) {
    return renderError('Título, fecha y bloque son obligatorios.', { title, description, date, blockId });
  }

  // Obtener el bloque seleccionado
  const block = AvailabilityBlock.findByUser(userId).find(b => b.id === parseInt(blockId));
  if (!block) {
    return renderError('El bloque seleccionado no es válido.', { title, description, date, blockId });
  }

  // Validar que la fecha seleccionada corresponda al día de la semana del bloque
  const selectedDate = new Date(date + 'T00:00:00');
  const dayOfWeek = selectedDate.getDay(); // 0=domingo, 1=lunes...
  const ourDay = dayOfWeek === 0 ? 7 : dayOfWeek;
  if (block.day_of_week !== ourDay) {
    return renderError('El bloque seleccionado no corresponde al día de la fecha elegida.', { title, description, date, blockId });
  }

  // Validar que el bloque no haya pasado y que quepa la reunión
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (date === todayStr) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    if (block.end_minutes <= currentMinutes) {
      return renderError(
        'Este bloque ya ha terminado para hoy. Por favor, selecciona otro día o bloque.',
        { title, description, date, blockId }
      );
    }
    const remainingMinutes = block.end_minutes - currentMinutes;
    if (remainingMinutes < pref.meeting_duration) {
      return renderError(
        `El tiempo restante del bloque (${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}min) es insuficiente para la duración de la reunión (${Math.floor(pref.meeting_duration / 60)}h ${pref.meeting_duration % 60}min). Por favor, selecciona otro bloque.`,
        { title, description, date, blockId }
      );
    }
  }

  // Calcular inicio y fin del evento
  const startDate = new Date(date + 'T00:00:00');
  startDate.setHours(Math.floor(block.start_minutes / 60), block.start_minutes % 60, 0, 0);
  const endDate = new Date(startDate);
  endDate.setMinutes(endDate.getMinutes() + pref.meeting_duration);

  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
  if (endMinutes > block.end_minutes) {
    return renderError(
      'La duración de la reunión excede el bloque de disponibilidad. Por favor, elige otro bloque o reduce la duración.',
      { title, description, date, blockId }
    );
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
    return renderError(
      'La franja horaria seleccionada coincide con otro evento existente. Por favor, elige otro bloque.',
      { title, description, date, blockId }
    );
  }

  // Crear evento
  try {
    Event.create({
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
