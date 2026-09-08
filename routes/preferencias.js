const express = require('express');
const Preferencia = require('../models/Preferencia');
const router = express.Router();

// Obtener preferencias del usuario autenticado
router.get('/', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  
  const pref = Preferencia.getByUser(userId);
  if (!pref) {
    return res.json({
      tema: 'claro',
      formato_hora: '24',
      meeting_duration: 60,
      contact_phone: '',
      meeting_address: ''
    });
  }
  res.json(pref);
});

// Actualizar preferencias del usuario
router.put('/', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });

  const { tema, formato_hora, meeting_duration, contact_phone, meeting_address } = req.body;
  
  // Validar campos
  if (tema !== undefined && !['claro', 'oscuro'].includes(tema)) {
    return res.status(400).json({ error: 'Tema inválido' });
  }
  if (formato_hora !== undefined && !['24', '12'].includes(formato_hora)) {
    return res.status(400).json({ error: 'Formato de hora inválido' });
  }
  if (meeting_duration !== undefined && (typeof meeting_duration !== 'number' || meeting_duration < 15)) {
    return res.status(400).json({ error: 'Duración inválida (mínimo 15 minutos)' });
  }

  try {
    const current = Preferencia.getByUser(userId) || {};
    Preferencia.upsert(userId, {
      tema: tema || current.tema || 'claro',
      formato_hora: formato_hora || current.formato_hora || '24',
      meeting_duration: meeting_duration !== undefined ? meeting_duration : current.meeting_duration || 60,
      contact_phone: contact_phone !== undefined ? contact_phone : current.contact_phone || '',
      meeting_address: meeting_address !== undefined ? meeting_address : current.meeting_address || ''
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Error en PUT /api/preferencias:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
