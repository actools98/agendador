const db = require('../db');

class User {
  static findOne(username) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  }

  static create(username, passwordHash) {
    const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    const info = stmt.run(username, passwordHash);
    return info.lastInsertRowid;
  }
}

module.exports = User;
