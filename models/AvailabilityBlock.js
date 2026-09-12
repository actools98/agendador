const db = require('../db');

class AvailabilityBlock {
  static findByUser(userId) {
    const stmt = db.prepare('SELECT * FROM availability_blocks WHERE user_id = ? ORDER BY day_of_week, start_minutes');
    return stmt.all(userId);
  }

  static findByUserAndDay(userId, dayOfWeek) {
    const stmt = db.prepare('SELECT * FROM availability_blocks WHERE user_id = ? AND day_of_week = ? ORDER BY start_minutes');
    return stmt.all(userId, dayOfWeek);
  }

  static create(userId, { dayOfWeek, startMinutes, endMinutes }) {
    const stmt = db.prepare(`
      INSERT INTO availability_blocks (user_id, day_of_week, start_minutes, end_minutes)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(userId, dayOfWeek, startMinutes, endMinutes);
    return info.lastInsertRowid;
  }

  static update(id, userId, { dayOfWeek, startMinutes, endMinutes }) {
    const stmt = db.prepare(`
      UPDATE availability_blocks
      SET day_of_week = ?, start_minutes = ?, end_minutes = ?
      WHERE id = ? AND user_id = ?
    `);
    const info = stmt.run(dayOfWeek, startMinutes, endMinutes, id, userId);
    return info.changes > 0;
  }

  static delete(id, userId) {
    const stmt = db.prepare('DELETE FROM availability_blocks WHERE id = ? AND user_id = ?');
    const info = stmt.run(id, userId);
    return info.changes > 0;
  }

  static deleteByUser(userId) {
    const stmt = db.prepare('DELETE FROM availability_blocks WHERE user_id = ?');
    stmt.run(userId);
  }

  // Verificar solapamiento de bloques para un mismo día (excepto el bloque actual)
  static hasOverlap(userId, dayOfWeek, startMinutes, endMinutes, excludeId = null) {
    let query = `
      SELECT COUNT(*) as count FROM availability_blocks
      WHERE user_id = ? AND day_of_week = ?
        AND (start_minutes < ? AND end_minutes > ?)
    `;
    const params = [userId, dayOfWeek, endMinutes, startMinutes];
    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }
    const stmt = db.prepare(query);
    const result = stmt.get(...params);
    return result.count > 0;
  }
// Copia todos los bloques de un día origen a uno o varios días destino.
  // Si replaceExisting es true, elimina los bloques existentes de los destinos antes de copiar.
  static copyFromTo(userId, fromDay, toDays, replaceExisting = true) {
    const sourceBlocks = db.prepare(
      'SELECT start_minutes, end_minutes FROM availability_blocks WHERE user_id = ? AND day_of_week = ? ORDER BY start_minutes'
    ).all(userId, fromDay);

    if (sourceBlocks.length === 0) return { copied: 0, days: [] };

    const insert = db.prepare(
      'INSERT INTO availability_blocks (user_id, day_of_week, start_minutes, end_minutes) VALUES (?, ?, ?, ?)'
    );
    const del = db.prepare(
      'DELETE FROM availability_blocks WHERE user_id = ? AND day_of_week = ?'
    );

    let totalCopied = 0;
    const copiedDays = [];
    const tx = db.transaction(() => {
      for (const day of toDays) {
        if (day === fromDay) continue;
        if (replaceExisting) del.run(userId, day);
        for (const b of sourceBlocks) {
          insert.run(userId, day, b.start_minutes, b.end_minutes);
          totalCopied++;
        }
        copiedDays.push(day);
      }
    });
    tx();

    return { copied: totalCopied, days: copiedDays };
  }
}

module.exports = AvailabilityBlock;
