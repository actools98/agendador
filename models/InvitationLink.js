const db = require('../db');
const crypto = require('crypto');

class InvitationLink {
  // Genera un nuevo enlace para el usuario, invalidando cualquier enlace anterior
  static generate(userId) {
    // 1. Eliminar enlace anterior (si existe)
    const delStmt = db.prepare('DELETE FROM invitation_links WHERE user_id = ?');
    delStmt.run(userId);

    // 2. Generar nuevo token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // 3. Insertar nuevo enlace
    const insertStmt = db.prepare(`
      INSERT INTO invitation_links (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `);
    insertStmt.run(userId, token, expiresAt.toISOString());

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
