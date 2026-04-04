const express = require("express");
const OpenAI = require("openai").default;
const path = require("path");

const app = express();
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const QUESTIONS = [
  "Walk me through how you'd handle a cold call where the prospect says 'I'm not interested' in the first 10 seconds.",
  "It's 3pm. You have a quota of 50 calls today and you've only made 15. What do you do?",
  "How would you research a prospect before reaching out? Walk me through your full process.",
  "Describe a time you turned a 'no' into a 'yes' — or explain exactly how you would.",
  "A warm prospect went dark after two promising calls. What's your follow-up strategy?",
];

app.get("/api/questions", (req, res) => {
  res.json({ questions: QUESTIONS });
});

app.post("/api/score", async (req, res) => {
  const { answers } = req.body;

  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) {
    return res.status(400).json({ error: "Provide exactly 5 answers." });
  }

  const qa = QUESTIONS.map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${answers[i]}`).join("\n\n");

  const prompt = `You are a sales hiring expert evaluating an SDR (Sales Development Representative) candidate.

Score the following candidate responses on a scale of 0–100 and provide a hiring recommendation.

Evaluate across these dimensions:
- Resilience & objection handling
- Drive & self-motivation
- Process & preparation
- Communication clarity
- Closing instinct

---
${qa}
---

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "score": <integer 0-100>,
  "recommendation": "<Strong Hire | Hire | Consider | Reject>",
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "concerns": ["<concern 1>", "<concern 2>"],
  "dimension_scores": {
    "resilience": <0-100>,
    "drive": <0-100>,
    "process": <0-100>,
    "communication": <0-100>,
    "closing": <0-100>
  }
}`;

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0].message.content.trim();
    const result = JSON.parse(raw);
    res.json(result);
  } catch (err) {
    console.error("Scoring error:", err.message);
    res.status(500).json({ error: "Scoring failed. Check GROQ_API_KEY." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SalesAI running at http://localhost:${PORT}`));
