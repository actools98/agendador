const express = require('express');
const router = express.Router();
const InvitationLink = require('../models/InvitationLink');

// Generar enlace de invitación (solo para usuarios autenticados)
router.post('/', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const userId = req.session.userId;
    const token = InvitationLink.generate(userId);
    const baseUrl = req.protocol + '://' + req.get('host');
    const fullLink = `${baseUrl}/invite/${token}`;

    res.json({ link: fullLink, token });
  } catch (error) {
    console.error('Error generando enlace:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
