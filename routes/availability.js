const express = require('express');
const AvailabilityBlock = require('../models/AvailabilityBlock');
const router = express.Router();

// Obtener todos los bloques del usuario
router.get('/', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  
  const blocks = AvailabilityBlock.findByUser(userId);
  res.json(blocks);
});

// Crear un bloque
router.post('/', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });

  const { dayOfWeek, startMinutes, endMinutes } = req.body;
  
  // Validaciones
  if (dayOfWeek === undefined || startMinutes === undefined || endMinutes === undefined) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  if (dayOfWeek < 1 || dayOfWeek > 7) {
    return res.status(400).json({ error: 'Día de semana inválido (1-7)' });
  }
  if (startMinutes < 0 || startMinutes >= 1440 || endMinutes <= 0 || endMinutes > 1440) {
    return res.status(400).json({ error: 'Horas fuera de rango' });
  }
  if (startMinutes >= endMinutes) {
    return res.status(400).json({ error: 'La hora de inicio debe ser anterior a la de fin' });
  }

  // Verificar solapamiento
  if (AvailabilityBlock.hasOverlap(userId, dayOfWeek, startMinutes, endMinutes)) {
    return res.status(400).json({ error: 'El bloque solapa con otro existente' });
  }

  try {
    const id = AvailabilityBlock.create(userId, { dayOfWeek, startMinutes, endMinutes });
    res.status(201).json({ id });
  } catch (err) {
    console.error('Error creando bloque:', err);
    res.status(500).json({ error: err.message });
  }
});

// Actualizar un bloque
router.put('/:id', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });

  const id = parseInt(req.params.id);
  const { dayOfWeek, startMinutes, endMinutes } = req.body;
  
  // Validaciones
  if (dayOfWeek === undefined || startMinutes === undefined || endMinutes === undefined) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  if (dayOfWeek < 1 || dayOfWeek > 7) {
    return res.status(400).json({ error: 'Día de semana inválido (1-7)' });
  }
  if (startMinutes < 0 || startMinutes >= 1440 || endMinutes <= 0 || endMinutes > 1440) {
    return res.status(400).json({ error: 'Horas fuera de rango' });
  }
  if (startMinutes >= endMinutes) {
    return res.status(400).json({ error: 'La hora de inicio debe ser anterior a la de fin' });
  }

  // Verificar solapamiento (excluyendo el bloque actual)
  if (AvailabilityBlock.hasOverlap(userId, dayOfWeek, startMinutes, endMinutes, id)) {
    return res.status(400).json({ error: 'El bloque solapa con otro existente' });
  }

  try {
    const success = AvailabilityBlock.update(id, userId, { dayOfWeek, startMinutes, endMinutes });
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Bloque no encontrado' });
    }
  } catch (err) {
    console.error('Error actualizando bloque:', err);
    res.status(500).json({ error: err.message });
  }
});

// Eliminar un bloque
router.delete('/:id', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });

  const id = parseInt(req.params.id);
  try {
    const success = AvailabilityBlock.delete(id, userId);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Bloque no encontrado' });
    }
  } catch (err) {
    console.error('Error eliminando bloque:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
