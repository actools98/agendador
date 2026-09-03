const db = require('../db');

class Preferencia {
  static getByUser(userId) {
    const stmt = db.prepare('SELECT * FROM preferencias WHERE usuario_id = ?');
    return stmt.get(userId);
  }

  static upsert(userId, { tema, formato_hora, work_start, work_end, work_days, meeting_duration }) {
    const stmt = db.prepare(`
      INSERT INTO preferencias (usuario_id, tema, formato_hora, work_start, work_end, work_days, meeting_duration)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(usuario_id) DO UPDATE SET
        tema = excluded.tema,
        formato_hora = excluded.formato_hora,
        work_start = excluded.work_start,
        work_end = excluded.work_end,
        work_days = excluded.work_days,
        meeting_duration = excluded.meeting_duration
    `);
    return stmt.run(userId, tema, formato_hora, work_start, work_end, work_days, meeting_duration);
  }
}

module.exports = Preferencia;
