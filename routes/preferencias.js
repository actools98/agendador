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
      formato_hora: '24'
      // work_start y work_end ya no se devuelven
    });
  }
  res.json(pref);
});

// Actualizar preferencias del usuario (solo los campos que vengan)
router.put('/', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });

  const { tema, formato_hora } = req.body;
  
  // Validar solo los campos que se reciben
  if (tema !== undefined && !['claro', 'oscuro'].includes(tema)) {
    return res.status(400).json({ error: 'Tema inválido' });
  }
  if (formato_hora !== undefined && !['24', '12'].includes(formato_hora)) {
    return res.status(400).json({ error: 'Formato de hora inválido' });
  }

  try {
    // Obtener preferencias actuales para conservar los valores que no se envían
    const current = Preferencia.getByUser(userId) || {};
    Preferencia.upsert(userId, {
      tema: tema || current.tema || 'claro',
      formato_hora: formato_hora || current.formato_hora || '24',
      // Mantener los valores existentes de work_start y work_end (o usar defaults)
      work_start: current.work_start || 8,
      work_end: current.work_end || 17
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
