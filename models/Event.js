const db = require('../db');

class Event {
  static findByUser(userId) {
    const stmt = db.prepare('SELECT * FROM events WHERE user_id = ? ORDER BY start');
    return stmt.all(userId);
  }

  static findById(id, userId) {
    const stmt = db.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?');
    return stmt.get(id, userId);
  }

  static create({ userId, title, description, start, end, allDay, color }) {
    const stmt = db.prepare(`
      INSERT INTO events (user_id, title, description, start, end, all_day, color)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(userId, title, description, start, end, allDay ? 1 : 0, color || '#3788d8');
    return info.lastInsertRowid;
  }

  static update(id, userId, { title, description, start, end, allDay, color }) {
    const stmt = db.prepare(`
      UPDATE events
      SET title = ?, description = ?, start = ?, end = ?, all_day = ?, color = ?
      WHERE id = ? AND user_id = ?
    `);
    const info = stmt.run(title, description, start, end, allDay ? 1 : 0, color || '#3788d8', id, userId);
    return info.changes > 0;
  }

  static delete(id, userId) {
    const stmt = db.prepare('DELETE FROM events WHERE id = ? AND user_id = ?');
    const info = stmt.run(id, userId);
    return info.changes > 0;
  }
}

module.exports = Event;
