const db = require('../db');

class Preferencia {
  static getByUser(userId) {
    const stmt = db.prepare('SELECT * FROM preferencias WHERE usuario_id = ?');
    return stmt.get(userId);
  }

  static upsert(userId, { tema, formato_hora }) {
    const stmt = db.prepare(`
      INSERT INTO preferencias (usuario_id, tema, formato_hora)
      VALUES (?, ?, ?)
      ON CONFLICT(usuario_id) DO UPDATE SET
        tema = excluded.tema,
        formato_hora = excluded.formato_hora
    `);
    return stmt.run(userId, tema, formato_hora);
  }
}

module.exports = Preferencia;
