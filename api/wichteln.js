import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// In-memory storage (kleine Events OK). Für Persistenz DB verwenden.
let participants = []; // [{ name, pin }]
let assignments = {};  // pin -> recipientName
let started = false;

// Admin password: aus Umgebung oder Fallback (wie gewünscht)
const ADMIN_PASS = process.env.ADMIN_PASS || "wichteladmin93";

function checkAdminPassword(req, res) {
  const pw = (req.body && req.body.password) || req.query.password;
  if (!pw || pw !== ADMIN_PASS) {
    res.status(401).json({ error: "Ungültiges Admin-Passwort." });
    return false;
  }
  return true;
}

// --- API: add participant ---
app.post("/api/add", (req, res) => {
  if (started) return res.json({ error: "Wichteln bereits gestartet!" });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name fehlt" });
  if (participants.find(p => p.name === name))
    return res.json({ error: "Name bereits vorhanden!" });
  const pin = Math.random().toString(36).substring(2, 8).toUpperCase();
  participants.push({ name, pin });
  res.json({ pin });
});

// --- API: list participants & status ---
app.get("/api/list", (req, res) => {
  res.json({ names: participants.map(p => p.name), started });
});

// --- API: start (protected) ---
app.post("/api/start", (req, res) => {
  if (!checkAdminPassword(req, res)) return;
  if (participants.length < 2)
    return res.json({ error: "Mindestens zwei Teilnehmer nötig." });

  started = true;
  const names = participants.map(p => p.name);

  // Versuche zufällige Derangement (ohne Selbstzuweisung)
  let shuffled;
  let tries = 0;
  do {
    shuffled = [...names].sort(() => Math.random() - 0.5);
    tries++;
    if (tries > 5000) break;
  } while (names.some((n, i) => n === shuffled[i]));

  // Fallback: einfache Rotation, falls Zufall kein Derangement lieferte
  if (names.some((n, i) => n === shuffled[i])) {
    const n = names.length;
    shuffled = names.map((_, i) => names[(i + 1) % n]);
  }

  assignments = {};
  participants.forEach((p, i) => {
    assignments[p.pin] = shuffled[i];
  });

  res.json({ ok: true });
});

// --- API: reveal by PIN ---
app.post("/api/reveal", (req, res) => {
  const { pin } = req.body;
  if (!started) return res.json({ error: "Wichteln noch nicht gestartet." });
  const recipient = assignments[pin];
  if (!recipient) return res.json({ error: "Ungültiger PIN." });
  res.json({ recipient });
});

// --- API: reset all (protected) ---
app.post("/api/reset", (req, res) => {
  if (!checkAdminPassword(req, res)) return;
  participants = [];
  assignments = {};
  started = false;
  res.json({ ok: true });
});

export default app;
