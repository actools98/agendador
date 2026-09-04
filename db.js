const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'calendar.db');
const db = new Database(dbPath);

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
    all_day INTEGER DEFAULT 0,
    color TEXT DEFAULT '#3788d8',
    status TEXT DEFAULT 'active',
    categoria_id INTEGER,
    link TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    color TEXT DEFAULT '#6c757d',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(usuario_id, nombre)
  );

  CREATE TABLE IF NOT EXISTS preferencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL UNIQUE,
    tema TEXT DEFAULT 'claro' CHECK(tema IN ('claro', 'oscuro')),
    formato_hora TEXT DEFAULT '24' CHECK(formato_hora IN ('24', '12')),
    work_start INTEGER DEFAULT 480,
    work_end INTEGER DEFAULT 1020,
    work_days TEXT DEFAULT '1,2,3,4,5',
    meeting_duration INTEGER DEFAULT 60,
    contact_phone TEXT DEFAULT '',
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS invitation_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    token TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Migración: añadir columnas si no existen en events
const tableInfo = db.prepare("PRAGMA table_info(events)").all();
const hasStatus = tableInfo.some(col => col.name === 'status');
if (!hasStatus) {
  db.exec(`ALTER TABLE events ADD COLUMN status TEXT DEFAULT 'active';`);
  console.log('✅ Columna "status" añadida a la tabla events');
}
const hasCategoriaId = tableInfo.some(col => col.name === 'categoria_id');
if (!hasCategoriaId) {
  db.exec(`ALTER TABLE events ADD COLUMN categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL;`);
  console.log('✅ Columna "categoria_id" añadida a la tabla events');
}
const hasLink = tableInfo.some(col => col.name === 'link');
if (!hasLink) {
  db.exec(`ALTER TABLE events ADD COLUMN link TEXT;`);
  console.log('✅ Columna "link" añadida a la tabla events');
}
const hasAddress = tableInfo.some(col => col.name === 'address');
if (!hasAddress) {
  db.exec(`ALTER TABLE events ADD COLUMN address TEXT;`);
  console.log('✅ Columna "address" añadida a la tabla events');
}

// Migración: añadir columnas a preferencias
const prefInfo = db.prepare("PRAGMA table_info(preferencias)").all();
const hasWorkStart = prefInfo.some(col => col.name === 'work_start');
if (!hasWorkStart) {
  db.exec(`ALTER TABLE preferencias ADD COLUMN work_start INTEGER DEFAULT 480;`);
  console.log('✅ Columna "work_start" añadida a preferencias');
}
const hasWorkEnd = prefInfo.some(col => col.name === 'work_end');
if (!hasWorkEnd) {
  db.exec(`ALTER TABLE preferencias ADD COLUMN work_end INTEGER DEFAULT 1020;`);
  console.log('✅ Columna "work_end" añadida a preferencias');
}
const hasWorkDays = prefInfo.some(col => col.name === 'work_days');
if (!hasWorkDays) {
  db.exec(`ALTER TABLE preferencias ADD COLUMN work_days TEXT DEFAULT '1,2,3,4,5';`);
  console.log('✅ Columna "work_days" añadida a preferencias');
}
const hasMeetingDuration = prefInfo.some(col => col.name === 'meeting_duration');
if (!hasMeetingDuration) {
  db.exec(`ALTER TABLE preferencias ADD COLUMN meeting_duration INTEGER DEFAULT 60;`);
  console.log('✅ Columna "meeting_duration" añadida a preferencias');
}
const hasContactPhone = prefInfo.some(col => col.name === 'contact_phone');
if (!hasContactPhone) {
  db.exec(`ALTER TABLE preferencias ADD COLUMN contact_phone TEXT DEFAULT '';`);
  console.log('✅ Columna "contact_phone" añadida a preferencias');
}

module.exports = db;
