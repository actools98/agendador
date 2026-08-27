const express = require('express');
const Categoria = require('../models/Categoria');
const router = express.Router();

// Obtener todas las categorías del usuario
router.get('/', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  const categorias = Categoria.findByUser(userId);
  res.json(categorias);
});

// Crear una categoría
router.post('/', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  const { nombre, color } = req.body;
  if (!nombre || nombre.trim() === '') {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  try {
    const id = Categoria.create(userId, { nombre: nombre.trim(), color });
    res.status(201).json({ id });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Actualizar una categoría
router.put('/:id', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  const id = parseInt(req.params.id);
  const { nombre, color } = req.body;
  if (!nombre || nombre.trim() === '') {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  const existing = Categoria.findById(id, userId);
  if (!existing) {
    return res.status(404).json({ error: 'Categoría no encontrada' });
  }
  try {
    const success = Categoria.update(id, userId, { nombre: nombre.trim(), color });
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Error al actualizar' });
    }
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Eliminar una categoría
router.delete('/:id', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  const id = parseInt(req.params.id);
  const existing = Categoria.findById(id, userId);
  if (!existing) {
    return res.status(404).json({ error: 'Categoría no encontrada' });
  }
  const success = Categoria.delete(id, userId);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

module.exports = router;
