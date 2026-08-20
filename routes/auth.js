const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const router = express.Router();

const redirectIfLoggedIn = (req, res, next) => {
  if (req.session.userId) return res.redirect('/');
  next();
};

router.get('/login', redirectIfLoggedIn, (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', redirectIfLoggedIn, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('login', { error: 'Usuario y contraseña son obligatorios' });
  }
  const user = User.findOne(username);
  if (!user) {
    return res.render('login', { error: 'Usuario o contraseña incorrectos' });
  }
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.render('login', { error: 'Usuario o contraseña incorrectos' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  res.redirect('/');
});

router.get('/register', redirectIfLoggedIn, (req, res) => {
  res.render('register', { error: null });
});

router.post('/register', redirectIfLoggedIn, async (req, res) => {
  const { username, password, confirm } = req.body;
  if (!username || !password || !confirm) {
    return res.render('register', { error: 'Todos los campos son obligatorios' });
  }
  if (password !== confirm) {
    return res.render('register', { error: 'Las contraseñas no coinciden' });
  }
  if (password.length < 6) {
    return res.render('register', { error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  const existing = User.findOne(username);
  if (existing) {
    return res.render('register', { error: 'El nombre de usuario ya está en uso' });
  }
  const hash = await bcrypt.hash(password, 10);
  User.create(username, hash);
  res.redirect('/login');
});

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error(err);
    res.redirect('/login');
  });
});

module.exports = router;
