require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Sesiones
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 día
}));

// Base de datos persistente (archivo)
const db = new Database(path.join(__dirname, 'database', 'agenda.db'));
db.pragma('foreign_keys = ON');

// Crear tablas si no existen
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start DATETIME NOT NULL,
    end DATETIME NOT NULL,
    color TEXT DEFAULT '#3788d8',
    all_day BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Middleware de autenticación
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'No autenticado' });
  }
}

// ---------- Rutas de autenticación ----------
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  try {
    const hashed = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    stmt.run(username, hashed);
    res.status(201).json({ message: 'Usuario registrado' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'El usuario ya existe' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  const user = stmt.get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ message: 'Login exitoso', username: user.username });
});

app.get('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Sesión cerrada' });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session.userId) {
    res.json({ userId: req.session.userId, username: req.session.username });
  } else {
    res.status(401).json({ error: 'No autenticado' });
  }
});

// ---------- Rutas de eventos (protegidas) ----------
app.get('/api/events', isAuthenticated, (req, res) => {
  const stmt = db.prepare('SELECT * FROM events WHERE user_id = ? ORDER BY start');
  const events = stmt.all(req.session.userId);
  res.json(events);
});

app.post('/api/events', isAuthenticated, (req, res) => {
  const { title, description, start, end, color, all_day } = req.body;
  if (!title || !start || !end) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  const stmt = db.prepare(`
    INSERT INTO events (user_id, title, description, start, end, color, all_day)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    req.session.userId,
    title,
    description || null,
    start,
    end,
    color || '#3788d8',
    all_day ? 1 : 0
  );
  const newEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(newEvent);
});

app.put('/api/events/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const { title, description, start, end, color, all_day } = req.body;
  const check = db.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?');
  const existing = check.get(id, req.session.userId);
  if (!existing) {
    return res.status(404).json({ error: 'Evento no encontrado o no autorizado' });
  }
  const stmt = db.prepare(`
    UPDATE events
    SET title = ?, description = ?, start = ?, end = ?, color = ?, all_day = ?
    WHERE id = ? AND user_id = ?
  `);
  stmt.run(
    title || existing.title,
    description || existing.description,
    start || existing.start,
    end || existing.end,
    color || existing.color,
    all_day !== undefined ? (all_day ? 1 : 0) : existing.all_day,
    id,
    req.session.userId
  );
  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  res.json(updated);
});

app.delete('/api/events/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM events WHERE id = ? AND user_id = ?');
  const result = stmt.run(id, req.session.userId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Evento no encontrado o no autorizado' });
  }
  res.json({ message: 'Evento eliminado' });
});

// ---------- Festivos de Colombia (2025) ----------
app.get('/api/holidays', (req, res) => {
  const holidays = [
    { date: '2025-01-01', title: 'Año Nuevo' },
    { date: '2025-01-06', title: 'Día de los Reyes Magos' },
    { date: '2025-03-24', title: 'Día de San José' },
    { date: '2025-04-17', title: 'Jueves Santo' },
    { date: '2025-04-18', title: 'Viernes Santo' },
    { date: '2025-05-01', title: 'Día del Trabajo' },
    { date: '2025-06-02', title: 'Ascensión del Señor' },
    { date: '2025-06-23', title: 'Corpus Christi' },
    { date: '2025-06-30', title: 'Sagrado Corazón' },
    { date: '2025-07-01', title: 'San Pedro y San Pablo' },
    { date: '2025-07-20', title: 'Día de la Independencia' },
    { date: '2025-08-07', title: 'Batalla de Boyacá' },
    { date: '2025-08-18', title: 'Asunción de la Virgen' },
    { date: '2025-10-13', title: 'Día de la Raza' },
    { date: '2025-11-03', title: 'Todos los Santos' },
    { date: '2025-11-17', title: 'Independencia de Cartagena' },
    { date: '2025-12-08', title: 'Día de la Inmaculada Concepción' },
    { date: '2025-12-25', title: 'Navidad' }
  ];
  res.json(holidays);
});

// Servir dashboard si está autenticado, o index.html (pero manejamos todo desde el frontend)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
