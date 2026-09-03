const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// ===================== Configuración =====================
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'actols_super_secret_key_2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Crear carpeta de uploads si no existe
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Configuración de multer para PDFs
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + '-' + file.originalname);
  }
});
const upload = multer({ storage, fileFilter: (req, file, cb) => {
  if (file.mimetype === 'application/pdf') cb(null, true);
  else cb(new Error('Solo se permiten PDFs'), false);
}});

// ===================== Base de Datos =====================
const db = new Database('actols.db');
db.pragma('foreign_keys = ON');

// Crear tablas si no existen
const createTables = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    razon_social TEXT,
    nombre_comercial TEXT,
    nif_vat TEXT,
    tamano_empresa TEXT,
    industria_vertical TEXT,
    pais_region TEXT,
    sitio_web TEXT,
    no_contacto TEXT,
    email TEXT,
    fecha_primer_contacto TEXT,
    fecha_firma_contrato TEXT,
    estado_cliente TEXT,
    herramienta TEXT
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    url TEXT,
    repo_url TEXT,
    contrato_pdf TEXT,
    proceso TEXT DEFAULT 'Inactivo',
    facturacion TEXT DEFAULT 'No aplica',
    valor REAL DEFAULT 0,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asignado_a TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    completado INTEGER DEFAULT 0,
    orden INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    url TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    categoria TEXT,
    estado TEXT DEFAULT 'Pendiente',
    enlace TEXT,
    direccion TEXT,
    fecha_inicio TEXT NOT NULL,
    fecha_fin TEXT NOT NULL
  );
`;
db.exec(createTables);

// Insertar usuarios si no existen (hashes de las contraseñas)
const insertUsers = db.prepare(`
  INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)
`);
const hash1 = bcrypt.hashSync('b55f86bd4c353', 10);
const hash2 = bcrypt.hashSync('BDA98@', 10);
insertUsers.run('camilomuriel', hash1);
insertUsers.run('andresfel', hash2);

// ===================== Middleware de Autenticación =====================
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Token no proporcionado' });
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// ===================== Rutas API =====================

// --- Login ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan credenciales' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username });
});

// --- Clientes ---
app.get('/api/clients', authenticate, (req, res) => {
  const clients = db.prepare('SELECT * FROM clients ORDER BY id DESC').all();
  const stmt = db.prepare('SELECT id, nombre, proceso FROM projects WHERE client_id = ?');
  const result = clients.map(c => ({
    ...c,
    projects: stmt.all(c.id)
  }));
  res.json(result);
});

app.get('/api/clients/:id', authenticate, (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
  const projects = db.prepare('SELECT * FROM projects WHERE client_id = ?').all(req.params.id);
  res.json({ ...client, projects });
});

app.post('/api/clients', authenticate, (req, res) => {
  const { razon_social, nombre_comercial, nif_vat, tamano_empresa, industria_vertical, pais_region, sitio_web, no_contacto, email, fecha_primer_contacto, fecha_firma_contrato, estado_cliente, herramienta } = req.body;
  const stmt = db.prepare(`
    INSERT INTO clients (
      razon_social, nombre_comercial, nif_vat, tamano_empresa,
      industria_vertical, pais_region, sitio_web, no_contacto,
      email, fecha_primer_contacto, fecha_firma_contrato,
      estado_cliente, herramienta
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    razon_social, nombre_comercial, nif_vat, tamano_empresa,
    industria_vertical, pais_region, sitio_web, no_contacto,
    email, fecha_primer_contacto, fecha_firma_contrato,
    estado_cliente, herramienta
  );
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/clients/:id', authenticate, (req, res) => {
  const { razon_social, nombre_comercial, nif_vat, tamano_empresa, industria_vertical, pais_region, sitio_web, no_contacto, email, fecha_primer_contacto, fecha_firma_contrato, estado_cliente, herramienta } = req.body;
  const stmt = db.prepare(`
    UPDATE clients SET
      razon_social = ?, nombre_comercial = ?, nif_vat = ?,
      tamano_empresa = ?, industria_vertical = ?, pais_region = ?,
      sitio_web = ?, no_contacto = ?, email = ?,
      fecha_primer_contacto = ?, fecha_firma_contrato = ?,
      estado_cliente = ?, herramienta = ?
    WHERE id = ?
  `);
  const result = stmt.run(
    razon_social, nombre_comercial, nif_vat, tamano_empresa,
    industria_vertical, pais_region, sitio_web, no_contacto,
    email, fecha_primer_contacto, fecha_firma_contrato,
    estado_cliente, herramienta, req.params.id
  );
  if (result.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json({ success: true });
});

app.delete('/api/clients/:id', authenticate, (req, res) => {
  const result = db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json({ success: true });
});

// --- Proyectos ---
app.get('/api/projects', authenticate, (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY id DESC').all();
  res.json(projects);
});

app.get('/api/projects/:id', authenticate, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
  res.json(project);
});

app.post('/api/projects', authenticate, (req, res) => {
  const { client_id, nombre, url, repo_url, contrato_pdf, proceso, facturacion, valor } = req.body;
  const stmt = db.prepare(`
    INSERT INTO projects (client_id, nombre, url, repo_url, contrato_pdf, proceso, facturacion, valor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(client_id, nombre, url, repo_url, contrato_pdf, proceso, facturacion, valor || 0);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/projects/:id', authenticate, (req, res) => {
  const { client_id, nombre, url, repo_url, contrato_pdf, proceso, facturacion, valor } = req.body;
  const stmt = db.prepare(`
    UPDATE projects SET
      client_id = ?, nombre = ?, url = ?, repo_url = ?,
      contrato_pdf = ?, proceso = ?, facturacion = ?, valor = ?
    WHERE id = ?
  `);
  const result = stmt.run(client_id, nombre, url, repo_url, contrato_pdf, proceso, facturacion, valor || 0, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Proyecto no encontrado' });
  res.json({ success: true });
});

app.delete('/api/projects/:id', authenticate, (req, res) => {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Proyecto no encontrado' });
  res.json({ success: true });
});

// Subir PDF de contrato
app.post('/api/projects/:id/upload', authenticate, upload.single('contrato'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  const filePath = '/uploads/' + req.file.filename;
  const stmt = db.prepare('UPDATE projects SET contrato_pdf = ? WHERE id = ?');
  const result = stmt.run(filePath, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Proyecto no encontrado' });
  res.json({ success: true, filePath });
});

// --- Tareas ---
app.get('/api/tasks', authenticate, (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY asignado_a, orden ASC, id ASC').all();
  res.json(tasks);
});

app.post('/api/tasks', authenticate, (req, res) => {
  const { asignado_a, titulo, descripcion } = req.body;
  const stmt = db.prepare(`
    INSERT INTO tasks (asignado_a, titulo, descripcion, completado, orden)
    VALUES (?, ?, ?, 0, (SELECT COALESCE(MAX(orden),0)+1 FROM tasks WHERE asignado_a = ?))
  `);
  const info = stmt.run(asignado_a, titulo, descripcion, asignado_a);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/tasks/:id', authenticate, (req, res) => {
  const { titulo, descripcion, completado, asignado_a, orden } = req.body;
  const stmt = db.prepare(`
    UPDATE tasks SET titulo = ?, descripcion = ?, completado = ?, asignado_a = ?, orden = ?
    WHERE id = ?
  `);
  const result = stmt.run(titulo, descripcion, completado, asignado_a, orden, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
  res.json({ success: true });
});

app.delete('/api/tasks/:id', authenticate, (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
  res.json({ success: true });
});

// --- Enlaces ---
app.get('/api/links', authenticate, (req, res) => {
  const links = db.prepare('SELECT * FROM links ORDER BY id DESC').all();
  res.json(links);
});

app.post('/api/links', authenticate, (req, res) => {
  const { nombre, url } = req.body;
  const stmt = db.prepare('INSERT INTO links (nombre, url) VALUES (?, ?)');
  const info = stmt.run(nombre, url);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/links/:id', authenticate, (req, res) => {
  const { nombre, url } = req.body;
  const stmt = db.prepare('UPDATE links SET nombre = ?, url = ? WHERE id = ?');
  const result = stmt.run(nombre, url, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Enlace no encontrado' });
  res.json({ success: true });
});

app.delete('/api/links/:id', authenticate, (req, res) => {
  const result = db.prepare('DELETE FROM links WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Enlace no encontrado' });
  res.json({ success: true });
});

// ===================== Rutas de Eventos =====================
app.get('/api/events', authenticate, (req, res) => {
  const events = db.prepare('SELECT * FROM events ORDER BY fecha_inicio ASC').all();
  res.json(events);
});

app.get('/api/events/:id', authenticate, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
  res.json(event);
});

app.post('/api/events', authenticate, (req, res) => {
  const { titulo, descripcion, categoria, estado, enlace, direccion, fecha_inicio, fecha_fin } = req.body;
  const stmt = db.prepare(`
    INSERT INTO events (titulo, descripcion, categoria, estado, enlace, direccion, fecha_inicio, fecha_fin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(titulo, descripcion, categoria, estado, enlace, direccion, fecha_inicio, fecha_fin);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/events/:id', authenticate, (req, res) => {
  const { titulo, descripcion, categoria, estado, enlace, direccion, fecha_inicio, fecha_fin } = req.body;
  const stmt = db.prepare(`
    UPDATE events SET
      titulo = ?, descripcion = ?, categoria = ?, estado = ?,
      enlace = ?, direccion = ?, fecha_inicio = ?, fecha_fin = ?
    WHERE id = ?
  `);
  const result = stmt.run(titulo, descripcion, categoria, estado, enlace, direccion, fecha_inicio, fecha_fin, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Evento no encontrado' });
  res.json({ success: true });
});

app.delete('/api/events/:id', authenticate, (req, res) => {
  const result = db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Evento no encontrado' });
  res.json({ success: true });
});

// ===================== Iniciar servidor =====================
app.listen(PORT, () => {
  console.log(`🚀 Servidor Actols Central corriendo en http://localhost:${PORT}`);
});
