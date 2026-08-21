const db = require('../db');

class Event {
  static findByUser(userId, statusFilter = 'active') {
    // statusFilter puede ser 'active' o 'all' o un array de estados
    let query = 'SELECT * FROM events WHERE user_id = ?';
    const params = [userId];
    if (statusFilter === 'active') {
      query += " AND status = 'active'";
    } else if (Array.isArray(statusFilter)) {
      const placeholders = statusFilter.map(() => '?').join(',');
      query += ` AND status IN (${placeholders})`;
      params.push(...statusFilter);
    }
    query += ' ORDER BY start';
    const stmt = db.prepare(query);
    return stmt.all(...params);
  }

  static findById(id, userId) {
    const stmt = db.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?');
    return stmt.get(id, userId);
  }

  static create({ userId, title, description, start, end, allDay, color, status = 'active' }) {
    const stmt = db.prepare(`
      INSERT INTO events (user_id, title, description, start, end, all_day, color, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(userId, title, description, start, end, allDay ? 1 : 0, color || '#3788d8', status);
    return info.lastInsertRowid;
  }

  static update(id, userId, { title, description, start, end, allDay, color, status }) {
    const stmt = db.prepare(`
      UPDATE events
      SET title = ?, description = ?, start = ?, end = ?, all_day = ?, color = ?, status = ?
      WHERE id = ? AND user_id = ?
    `);
    const info = stmt.run(
      title,
      description,
      start,
      end,
      allDay ? 1 : 0,
      color || '#3788d8',
      status || 'active',
      id,
      userId
    );
    return info.changes > 0;
  }

  static delete(id, userId) {
    const stmt = db.prepare('DELETE FROM events WHERE id = ? AND user_id = ?');
    const info = stmt.run(id, userId);
    return info.changes > 0;
  }
}

module.exports = Event;
