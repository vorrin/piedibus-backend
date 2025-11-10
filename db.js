const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./data.db");

// Run once: create a table
db.serialize(() => {
  db.run(`
  CREATE TABLE IF NOT EXISTS Kids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )
  `);
});

module.exports = db;

