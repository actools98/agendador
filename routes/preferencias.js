const express = require('express');
const Preferencia = require('../models/Preferencia');
const router = express.Router();

// Obtener preferencias del usuario autenticado
router.get('/', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  
  const pref = Preferencia.getByUser(userId);
  if (!pref) {
    // Devolver valores por defecto
    return res.json({
      tema: 'claro',
      formato_hora: '24',
      work_start: 8,
      work_end: 17
    });
  }
  res.json(pref);
});

// Actualizar preferencias del usuario
router.put('/', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });

  const { tema, formato_hora, work_start, work_end } = req.body;
  
  // Validaciones
  if (!['claro', 'oscuro'].includes(tema)) {
    return res.status(400).json({ error: 'Tema inválido' });
  }
  if (!['24', '12'].includes(formato_hora)) {
    return res.status(400).json({ error: 'Formato de hora inválido' });
  }
  if (isNaN(work_start) || work_start < 0 || work_start > 23) {
    return res.status(400).json({ error: 'Hora de inicio inválida' });
  }
  if (isNaN(work_end) || work_end < 0 || work_end > 23) {
    return res.status(400).json({ error: 'Hora de fin inválida' });
  }
  if (work_start >= work_end) {
    return res.status(400).json({ error: 'La hora de inicio debe ser anterior a la hora de fin' });
  }

  try {
    Preferencia.upsert(userId, { tema, formato_hora, work_start, work_end });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
