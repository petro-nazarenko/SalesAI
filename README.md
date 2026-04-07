# SalesAI - Recruiter + Candidate Assessment

Single server + static frontend app for SDR candidate assessment with SQLite persistence.

## Key improvements

1. Persistence in SQLite for every saved assessment.
2. Two modes in one `public/index.html`:
- Recruiter dashboard (create session, custom questions, compare candidates).
- Candidate flow via unique link `/?session=<token>`.
3. Scoring transparency:
- Rubric per dimension (`high/medium/low`).
- Answer-level contributions showing which answer affected each dimension and why.
4. Custom questions editable by recruiter before link sharing, stored as JSON.
5. Groq API key is used only in browser (`sessionStorage`), never sent to server.
6. Jest endpoint tests.

## Tech

- Backend: Node.js + Express + better-sqlite3
- Frontend: plain HTML/CSS/JS (no build step)
- AI scoring: direct browser call to Groq API (`llama-3.3-70b-versatile`)

## Database

### `sessions`
- `id`
- `token`
- `title`
- `date`
- `questions_json`

### `assessments`
- `id`
- `candidate_name`
- `date`
- `score`
- `recommendation`
- `dimension_scores` (JSON)
- `answers` (JSON)
- `session_token`
- `rubric` (JSON)
- `contributions` (JSON)
- `summary`
- `strengths` (JSON)
- `concerns` (JSON)

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Tests

```bash
npm test
```

Current tests cover:
- creating recruiter sessions
- retrieving a session by token
- saving and reading full assessment payload with JSON fields

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/questions` | Default question template |
| POST | `/api/sessions` | Create recruiter session with custom questions |
| GET | `/api/sessions` | List all sessions + aggregates |
| GET | `/api/sessions/:token` | Candidate session payload |
| POST | `/api/assessments` | Save final assessment |
| GET | `/api/assessments` | List all assessments |
| GET | `/api/assessments?session_token=<token>` | List by session |
