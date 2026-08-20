const express = require('express');
const Event = require('../models/Event');
const router = express.Router();

// Obtener todos los eventos del usuario autenticado
router.get('/', (req, res) => {
  const userId = req.session.userId;
  const events = Event.findByUser(userId);
  res.json(events);
});

// Crear nuevo evento
router.post('/', (req, res) => {
  const userId = req.session.userId;
  const { title, description, start, end, allDay, color } = req.body;
  if (!title || !start || !end) {
    return res.status(400).json({ error: 'Título, inicio y fin son obligatorios' });
  }

  const id = Event.create({
    userId,
    title,
    description,
    start,
    end,
    allDay: allDay === 'true' || allDay === true,
    color,
  });
  res.status(201).json({ id });
});

// Actualizar evento
router.put('/:id', (req, res) => {
  const userId = req.session.userId;
  const eventId = parseInt(req.params.id);
  const { title, description, start, end, allDay, color } = req.body;

  const existing = Event.findById(eventId, userId);
  if (!existing) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }

  const success = Event.update(eventId, userId, {
    title,
    description,
    start,
    end,
    allDay: allDay === 'true' || allDay === true,
    color,
  });
  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// Eliminar evento
router.delete('/:id', (req, res) => {
  const userId = req.session.userId;
  const eventId = parseInt(req.params.id);

  const existing = Event.findById(eventId, userId);
  if (!existing) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }

  const success = Event.delete(eventId, userId);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

module.exports = router;
