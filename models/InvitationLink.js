const db = require('../db');
const crypto = require('crypto');

class InvitationLink {
  // Genera un nuevo enlace para el usuario, invalidando cualquier enlace anterior
  static generate(userId) {
    // Eliminar enlace anterior si existe (opcional, pero con UNIQUE se puede hacer UPSERT)
    // Usamos INSERT OR REPLACE con un token nuevo y expires_at.
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO invitation_links (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(userId, token, expiresAt.toISOString());
    return token;
  }

  // Busca un token y retorna el registro si es válido (no expirado)
  static findByToken(token) {
    const stmt = db.prepare(`
      SELECT * FROM invitation_links
      WHERE token = ? AND expires_at > datetime('now')
    `);
    return stmt.get(token);
  }

  // Invalida (elimina) el enlace de un usuario
  static invalidate(userId) {
    const stmt = db.prepare('DELETE FROM invitation_links WHERE user_id = ?');
    stmt.run(userId);
  }
}

module.exports = InvitationLink;
