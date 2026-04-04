# SalesAI — SDR Assessment Tool

Single-page web app that evaluates SDR candidates with AI scoring.

## What it does

Candidate answers 5 sales-specific questions. AI scores responses 0–100 and returns:
- Overall score + hiring recommendation (`Strong Hire / Hire / Consider / Reject`)
- 2–3 sentence summary
- Strengths and concerns
- Dimension breakdown: Resilience, Drive, Process, Communication, Closing

## Stack

- **Backend:** Node.js + Express
- **Frontend:** React (CDN, no build step)
- **AI:** Groq API — `llama-3.3-70b-versatile`

## Setup

```bash
cp .env.example .env
# Add your Groq API key to .env
```

Get a free API key at [console.groq.com](https://console.groq.com).

## Run

```bash
./start.sh
```

Open [http://localhost:3000](http://localhost:3000).

> **Note (Termux):** `/storage/emulated/0` is a fuse filesystem. Dependencies are installed to `~/salesai-deps/` automatically by `start.sh`.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/questions` | Returns the 5 assessment questions |
| POST | `/api/score` | Scores candidate answers, returns JSON result |

`POST /api/score` body:
```json
{ "answers": ["answer1", "answer2", "answer3", "answer4", "answer5"] }
```
