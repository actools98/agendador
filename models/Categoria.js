const db = require('../db');

class Categoria {
  static findByUser(userId) {
    const stmt = db.prepare('SELECT * FROM categorias WHERE usuario_id = ? ORDER BY nombre');
    return stmt.all(userId);
  }

  static findById(id, userId) {
    const stmt = db.prepare('SELECT * FROM categorias WHERE id = ? AND usuario_id = ?');
    return stmt.get(id, userId);
  }

  static create(userId, { nombre, color }) {
    const stmt = db.prepare('INSERT INTO categorias (usuario_id, nombre, color) VALUES (?, ?, ?)');
    const info = stmt.run(userId, nombre, color || '#6c757d');
    return info.lastInsertRowid;
  }

  static update(id, userId, { nombre, color }) {
    const stmt = db.prepare('UPDATE categorias SET nombre = ?, color = ? WHERE id = ? AND usuario_id = ?');
    const info = stmt.run(nombre, color, id, userId);
    return info.changes > 0;
  }

  static delete(id, userId) {
    // Primero actualizar eventos que tengan esta categoría para que queden sin categoría
    const updateEvents = db.prepare('UPDATE events SET categoria_id = NULL WHERE categoria_id = ? AND user_id = ?');
    updateEvents.run(id, userId);
    const stmt = db.prepare('DELETE FROM categorias WHERE id = ? AND usuario_id = ?');
    const info = stmt.run(id, userId);
    return info.changes > 0;
  }

  // Crear categorías por defecto para un usuario nuevo
  static createDefaultCategories(userId) {
    const defaults = [
      { nombre: 'Trabajo', color: '#e74c3c' },
      { nombre: 'Personal', color: '#3498db' },
      { nombre: 'Salud', color: '#2ecc71' },
      { nombre: 'Estudio', color: '#f39c12' },
      { nombre: 'Familia', color: '#9b59b6' },
      { nombre: 'Ocio', color: '#1abc9c' }
    ];
    const stmt = db.prepare('INSERT OR IGNORE INTO categorias (usuario_id, nombre, color) VALUES (?, ?, ?)');
    const insertMany = db.transaction((items) => {
      for (const item of items) {
        stmt.run(userId, item.nombre, item.color);
      }
    });
    insertMany(defaults);
  }
}

module.exports = Categoria;
