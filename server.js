const crypto = require("crypto");
const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const db = new Database(process.env.DB_PATH || path.join(__dirname, "assessments.db"));

const DEFAULT_QUESTIONS = [
  "Walk me through how you'd handle a cold call where the prospect says 'I'm not interested' in the first 10 seconds.",
  "It's 3pm. You have a quota of 50 calls today and you've only made 15. What do you do?",
  "How would you research a prospect before reaching out? Walk me through your full process.",
  "Describe a time you turned a 'no' into a 'yes' - or explain exactly how you would.",
  "A warm prospect went dark after two promising calls. What's your follow-up strategy?",
];

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    title TEXT,
    date TEXT NOT NULL,
    questions_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_name TEXT NOT NULL,
    date TEXT NOT NULL,
    score INTEGER NOT NULL,
    recommendation TEXT NOT NULL,
    dimension_scores TEXT NOT NULL,
    answers TEXT NOT NULL,
    session_token TEXT,
    rubric TEXT,
    contributions TEXT,
    summary TEXT,
    strengths TEXT,
    concerns TEXT
  );
`);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const insertSessionStmt = db.prepare(`
  INSERT INTO sessions (token, title, date, questions_json)
  VALUES (@token, @title, @date, @questions_json)
`);

const insertAssessmentStmt = db.prepare(`
  INSERT INTO assessments (
    candidate_name,
    date,
    score,
    recommendation,
    dimension_scores,
    answers,
    session_token,
    rubric,
    contributions,
    summary,
    strengths,
    concerns
  ) VALUES (
    @candidate_name,
    @date,
    @score,
    @recommendation,
    @dimension_scores,
    @answers,
    @session_token,
    @rubric,
    @contributions,
    @summary,
    @strengths,
    @concerns
  )
`);

function parseJsonSafe(value, fallback) {
  if (!value) return fallback;
  try {
    const text = String(value);
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return fallback;
  }
}

function normalizeQuestions(rawQuestions) {
  if (!Array.isArray(rawQuestions)) return null;
  const questions = rawQuestions
    .map((q) => (typeof q === "string" ? q.trim() : ""))
    .filter(Boolean);

  if (questions.length < 3) return null;
  if (questions.length > 12) return null;
  return questions;
}

app.get("/api/questions", (req, res) => {
  res.json({ questions: DEFAULT_QUESTIONS });
});

app.post("/api/sessions", (req, res) => {
  const questions = normalizeQuestions(req.body?.questions || DEFAULT_QUESTIONS);
  if (!questions) {
    return res.status(400).json({ error: "questions must contain 3 to 12 non-empty items." });
  }

  const token = crypto.randomBytes(10).toString("hex");
  const row = {
    token,
    title: typeof req.body?.title === "string" ? req.body.title.trim() : "",
    date: new Date().toISOString(),
    questions_json: JSON.stringify(questions),
  };

  insertSessionStmt.run(row);
  res.status(201).json({
    id: db.prepare("SELECT id FROM sessions WHERE token = ?").get(token).id,
    token,
    title: row.title,
    questions,
    link: `${req.protocol}://${req.get("host")}/?session=${token}`,
  });
});

app.get("/api/sessions", (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.id, s.token, s.title, s.date, s.questions_json,
              COUNT(a.id) AS candidate_count,
              ROUND(AVG(a.score), 1) AS avg_score
       FROM sessions s
       LEFT JOIN assessments a ON a.session_token = s.token
       GROUP BY s.id
       ORDER BY s.id DESC`
    )
    .all();

  res.json(
    rows.map((row) => ({
      id: row.id,
      token: row.token,
      title: row.title,
      date: row.date,
      candidate_count: row.candidate_count,
      avg_score: row.avg_score,
      questions: parseJsonSafe(row.questions_json, []),
      link: `${req.protocol}://${req.get("host")}/?session=${row.token}`,
    }))
  );
});

app.get("/api/sessions/:token", (req, res) => {
  const row = db.prepare("SELECT * FROM sessions WHERE token = ?").get(req.params.token);
  if (!row) return res.status(404).json({ error: "Session not found." });

  res.json({
    id: row.id,
    token: row.token,
    title: row.title,
    date: row.date,
    questions: parseJsonSafe(row.questions_json, []),
  });
});

app.post("/api/assessments", (req, res) => {
  const body = req.body || {};
  const candidateName = typeof body.candidate_name === "string" ? body.candidate_name.trim() : "";
  const answers = Array.isArray(body.answers) ? body.answers : null;
  const dimensionScores = body.dimension_scores && typeof body.dimension_scores === "object" ? body.dimension_scores : null;

  if (!candidateName) return res.status(400).json({ error: "candidate_name is required." });
  if (!answers || !answers.length) return res.status(400).json({ error: "answers are required." });
  if (!dimensionScores) return res.status(400).json({ error: "dimension_scores is required." });
  if (!Number.isFinite(body.score)) return res.status(400).json({ error: "score must be numeric." });
  if (!body.recommendation) return res.status(400).json({ error: "recommendation is required." });

  if (body.session_token) {
    const session = db.prepare("SELECT token FROM sessions WHERE token = ?").get(body.session_token);
    if (!session) return res.status(400).json({ error: "Invalid session_token." });
  }

  const row = {
    candidate_name: candidateName,
    date: new Date().toISOString(),
    score: Math.max(0, Math.min(100, Math.round(body.score))),
    recommendation: String(body.recommendation),
    dimension_scores: JSON.stringify(dimensionScores),
    answers: JSON.stringify(answers),
    session_token: body.session_token || null,
    rubric: body.rubric ? JSON.stringify(body.rubric) : null,
    contributions: body.contributions ? JSON.stringify(body.contributions) : null,
    summary: body.summary || null,
    strengths: Array.isArray(body.strengths) ? JSON.stringify(body.strengths) : null,
    concerns: Array.isArray(body.concerns) ? JSON.stringify(body.concerns) : null,
  };

  const info = insertAssessmentStmt.run(row);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.get("/api/assessments", (req, res) => {
  const token = typeof req.query.session_token === "string" ? req.query.session_token : "";
  const stmt = token
    ? db.prepare("SELECT * FROM assessments WHERE session_token = ? ORDER BY id DESC")
    : db.prepare("SELECT * FROM assessments ORDER BY id DESC");
  const rows = token ? stmt.all(token) : stmt.all();

  res.json(
    rows.map((row) => ({
      id: row.id,
      candidate_name: row.candidate_name,
      date: row.date,
      score: row.score,
      recommendation: row.recommendation,
      dimension_scores: parseJsonSafe(row.dimension_scores, {}),
      answers: parseJsonSafe(row.answers, []),
      session_token: row.session_token,
      rubric: parseJsonSafe(row.rubric, null),
      contributions: parseJsonSafe(row.contributions, null),
      summary: row.summary,
      strengths: parseJsonSafe(row.strengths, []),
      concerns: parseJsonSafe(row.concerns, []),
    }))
  );
});

// Backward-compatible alias for the old results page.
app.get("/api/results", (req, res) => {
  const rows = db.prepare("SELECT * FROM assessments ORDER BY id DESC").all();
  res.json(
    rows.map((row) => ({
      id: row.id,
      candidate_name: row.candidate_name,
      date: row.date,
      score: row.score,
      recommendation: row.recommendation,
      dimension_scores: parseJsonSafe(row.dimension_scores, {}),
      answers: parseJsonSafe(row.answers, []),
      session_token: row.session_token,
    }))
  );
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SalesAI running at http://0.0.0.0:${PORT}`);
  });
}

module.exports = { app, db };
