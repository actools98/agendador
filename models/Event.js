const db = require('../db');

class Event {
  static findByUser(userId, statusFilter = 'active') {
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

  static create({ userId, title, description, start, end, allDay, color, status = 'active', categoria_id }) {
    const stmt = db.prepare(`
      INSERT INTO events (user_id, title, description, start, end, all_day, color, status, categoria_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      userId,
      title,
      description,
      start,
      end,
      allDay ? 1 : 0,
      color || '#3788d8',
      status,
      categoria_id || null
    );
    return info.lastInsertRowid;
  }

  static update(id, userId, { title, description, start, end, allDay, color, status, categoria_id }) {
    const stmt = db.prepare(`
      UPDATE events
      SET title = ?, description = ?, start = ?, end = ?, all_day = ?, color = ?, status = ?, categoria_id = ?
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
      categoria_id || null,
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
