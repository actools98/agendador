require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const preferenciasRoutes = require('./routes/preferencias');
const categoriasRoutes = require('./routes/categorias');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.use(session({
  secret: process.env.SESSION_SECRET || 'mi_secreto_por_defecto',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.redirect('/login');
  next();
};

app.use('/', authRoutes);
app.use('/api/events', requireAuth, eventRoutes);
app.use('/api/preferencias', requireAuth, preferenciasRoutes);
app.use('/api/categorias', requireAuth, categoriasRoutes);

app.get('/', requireAuth, (req, res) => {
  res.render('index', { username: req.session.username });
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
