const express = require('express');
const Event = require('../models/Event');
const Categoria = require('../models/Categoria'); // <-- Importado para validar categoría
const router = express.Router();

// Obtener todos los eventos del usuario (sin filtrar, el frontend separa)
router.get('/', (req, res) => {
  const userId = req.session.userId;
  const events = Event.findByUser(userId, 'all'); // Trae todos
  res.json(events);
});

router.post('/', (req, res) => {
  const userId = req.session.userId;
  const { title, description, start, end, allDay, color, status, categoria_id } = req.body;

  if (!title || !start || !end) {
    return res.status(400).json({ error: 'Título, inicio y fin son obligatorios' });
  }

  // Validar que la categoría exista y pertenezca al usuario (si se envía)
  if (categoria_id) {
    const cat = Categoria.findById(categoria_id, userId);
    if (!cat) {
      return res.status(400).json({ error: 'Categoría no válida' });
    }
  }

  const id = Event.create({
    userId,
    title,
    description,
    start,
    end,
    allDay: allDay === 'true' || allDay === true,
    color,
    status: status || 'active',
    categoria_id: categoria_id || null, // <-- se pasa al modelo
  });
  res.status(201).json({ id });
});

router.put('/:id', (req, res) => {
  const userId = req.session.userId;
  const eventId = parseInt(req.params.id);
  const { title, description, start, end, allDay, color, status, categoria_id } = req.body;

  const existing = Event.findById(eventId, userId);
  if (!existing) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }

  // Validar categoría si se envía
  if (categoria_id) {
    const cat = Categoria.findById(categoria_id, userId);
    if (!cat) {
      return res.status(400).json({ error: 'Categoría no válida' });
    }
  }

  const success = Event.update(eventId, userId, {
    title,
    description,
    start,
    end,
    allDay: allDay === 'true' || allDay === true,
    color,
    status: status || 'active',
    categoria_id: categoria_id || null,
  });

  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

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
