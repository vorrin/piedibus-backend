const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("✅ Backend running");
});


app.use(express.json());

// ------------------- DB SETUP ----------------------

const db = new sqlite3.Database("./data.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS Kids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS Days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS Attendance (
      day_id INTEGER,
      kid_id INTEGER,
      present INTEGER DEFAULT 0,
      PRIMARY KEY (day_id, kid_id),
      FOREIGN KEY (day_id) REFERENCES Days(id),
      FOREIGN KEY (kid_id) REFERENCES Kids(id)
    )
  `);
});


// helper
function today() {
  return new Date().toISOString().split("T")[0];
}

// ------------------- API ROUTES ----------------------

app.post("/kids", (req, res) => {
  const { name } = req.body;

  db.run("INSERT INTO Kids (name) VALUES (?)", [name], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    const newKidId = this.lastID;

    // add new kid to today's attendance sheet
    db.get("SELECT id FROM Days WHERE date = ?", [today()], (err, dayRow) => {
      if (dayRow) {
        db.run(
          "INSERT INTO Attendance (day_id, kid_id, present) VALUES (?, ?, 0)",
          [dayRow.id, newKidId],
          () => res.json({ id: newKidId, name })
        );
      } else {
        res.json({ id: newKidId, name });
      }
    });
  });
});

// Get list of kids
app.get("/kids", (req, res) => {
  db.all("SELECT * FROM kids", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get("/attendance/today", (req, res) => {
  const date = today();

  db.get("SELECT id FROM Days WHERE date = ?", [date], (err, dayRow) => {
    if (!dayRow) {
      db.run("INSERT INTO Days (date) VALUES (?)", [date], function () {
        const dayId = this.lastID;

        db.run(
          `INSERT INTO Attendance (day_id, kid_id, present)
           SELECT ?, id, 0 FROM Kids`,
          [dayId],
          () => sendAttendance(dayId, date, res)
        );
      });
    } else {
      sendAttendance(dayRow.id, date, res);
    }
  });
});

// shared function
function sendAttendance(dayId, date, res) {
  db.all(
    `
    SELECT Attendance.kid_id, Kids.name, Attendance.present
    FROM Attendance
    JOIN Kids ON Attendance.kid_id = Kids.id
    WHERE Attendance.day_id = ?
    ORDER BY Kids.name ASC
  `,
    [dayId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        dayId,
        date,
        attendance: rows.map((r) => ({
          ...r,
          present: r.present === 1,
        })),
      });
    }
  );
}


app.post("/attendance/mark", (req, res) => {
  const { dayId, kidId, present } = req.body;

  db.run(
    "UPDATE Attendance SET present = ? WHERE day_id = ? AND kid_id = ?",
    [present ? 1 : 0, dayId, kidId],
    () => res.sendStatus(200)
  );
});


// Get list of days that have attendance
app.get("/days", (req, res) => {
  db.all(`SELECT id, date FROM Days ORDER BY date DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get attendance for a given date/day
app.get("/attendance/by-day/:dayId", (req, res) => {
  const dayId = req.params.dayId;

  db.get(`SELECT date FROM Days WHERE id = ?`, [dayId], (err, row) => {
    if (!row) return res.status(404).json({ error: "Day not found" });

    db.all(
      `
      SELECT Attendance.kid_id, Kids.name, Attendance.present
      FROM Attendance
      JOIN Kids ON Attendance.kid_id = Kids.id
      WHERE Attendance.day_id = ?
      ORDER BY Kids.name ASC
      `,
      [dayId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        res.json({
          dayId,
          date: row.date,
          attendance: rows.map((r) => ({
            ...r,
            present: r.present === 1,
          })),
        });
      }
    );
  });
});
// -----------------------------------------------------

app.listen(3001, () => console.log("✅ Backend running on http://localhost:3001"));
