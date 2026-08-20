require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const db = require('./db'); // Inicializa la BD

const app = express();
const port = process.env.PORT || 3000;

// Configuración de sesión
app.use(session({
  secret: process.env.SESSION_SECRET || 'mi_secreto_por_defecto',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 día
}));

// Motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para proteger rutas
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
};

// Rutas públicas
app.use('/', authRoutes);

// Rutas protegidas
app.use('/api/events', requireAuth, eventRoutes);

// Página principal
app.get('/', requireAuth, (req, res) => {
  res.render('index', { username: req.session.username });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
