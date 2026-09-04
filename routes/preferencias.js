const express = require('express');
const Preferencia = require('../models/Preferencia');
const router = express.Router();

// Obtener preferencias del usuario autenticado
router.get('/', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  
  const pref = Preferencia.getByUser(userId);
  if (!pref) {
    // Valores por defecto
    return res.json({
      tema: 'claro',
      formato_hora: '24',
      work_start: 480,
      work_end: 1020,
      work_days: '1,2,3,4,5',
      meeting_duration: 60,
      contact_phone: ''
    });
  }
  res.json(pref);
});

// Actualizar preferencias del usuario
router.put('/', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });

  const { tema, formato_hora, work_start, work_end, work_days, meeting_duration, contact_phone } = req.body;
  
  // Validar campos
  if (tema !== undefined && !['claro', 'oscuro'].includes(tema)) {
    return res.status(400).json({ error: 'Tema inválido' });
  }
  if (formato_hora !== undefined && !['24', '12'].includes(formato_hora)) {
    return res.status(400).json({ error: 'Formato de hora inválido' });
  }
  if (work_start !== undefined && (typeof work_start !== 'number' || work_start < 0 || work_start > 1440)) {
    return res.status(400).json({ error: 'Hora de inicio inválida' });
  }
  if (work_end !== undefined && (typeof work_end !== 'number' || work_end < 0 || work_end > 1440)) {
    return res.status(400).json({ error: 'Hora de fin inválida' });
  }
  if (work_start >= work_end) {
    return res.status(400).json({ error: 'La hora de inicio debe ser anterior a la de fin' });
  }
  if (work_days !== undefined && !/^([1-7](,[1-7])*)?$/.test(work_days)) {
    return res.status(400).json({ error: 'Días inválidos' });
  }
  if (meeting_duration !== undefined && (typeof meeting_duration !== 'number' || meeting_duration < 15)) {
    return res.status(400).json({ error: 'Duración inválida (mínimo 15 minutos)' });
  }

  try {
    const current = Preferencia.getByUser(userId) || {};
    Preferencia.upsert(userId, {
      tema: tema || current.tema || 'claro',
      formato_hora: formato_hora || current.formato_hora || '24',
      work_start: work_start !== undefined ? work_start : current.work_start || 480,
      work_end: work_end !== undefined ? work_end : current.work_end || 1020,
      work_days: work_days !== undefined ? work_days : current.work_days || '1,2,3,4,5',
      meeting_duration: meeting_duration !== undefined ? meeting_duration : current.meeting_duration || 60,
      contact_phone: contact_phone !== undefined ? contact_phone : current.contact_phone || ''
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
