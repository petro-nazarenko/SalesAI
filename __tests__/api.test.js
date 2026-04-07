const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");

const tmpDbPath = path.join(os.tmpdir(), `salesai-test-${Date.now()}.db`);
process.env.DB_PATH = tmpDbPath;

const { app, db } = require("../server");

describe("SalesAI API", () => {
  afterAll(() => {
    db.close();
    if (fs.existsSync(tmpDbPath)) {
      fs.unlinkSync(tmpDbPath);
    }
  });

  test("creates a custom recruiter session", async () => {
    const payload = {
      title: "April SDR batch",
      questions: [
        "Question 1?",
        "Question 2?",
        "Question 3?",
      ],
    };

    const res = await request(app).post("/api/sessions").send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.questions).toHaveLength(3);
    expect(res.body.link).toContain("?session=");
  });

  test("returns session by token", async () => {
    const create = await request(app).post("/api/sessions").send({
      title: "Token lookup",
      questions: ["A", "B", "C"],
    });

    const token = create.body.token;
    const read = await request(app).get(`/api/sessions/${token}`);

    expect(read.status).toBe(200);
    expect(read.body.token).toBe(token);
    expect(read.body.questions).toEqual(["A", "B", "C"]);
  });

  test("saves and returns full assessment payload", async () => {
    const create = await request(app).post("/api/sessions").send({
      title: "Assessment flow",
      questions: ["Q1", "Q2", "Q3"],
    });
    const token = create.body.token;

    const assessmentPayload = {
      candidate_name: "Jane Doe",
      session_token: token,
      answers: ["A1 details", "A2 details", "A3 details"],
      score: 84,
      recommendation: "Hire",
      summary: "Clear communicator with strong process orientation.",
      strengths: ["Consistency"],
      concerns: ["Closing depth"],
      dimension_scores: {
        resilience: 80,
        drive: 86,
        process: 90,
        communication: 88,
        closing: 76,
      },
      rubric: {
        resilience: { high: "X", medium: "Y", low: "Z" },
      },
      contributions: {
        resilience: [{ answer_index: 1, impact: "positive", reason: "Handled objection well" }],
      },
    };

    const save = await request(app).post("/api/assessments").send(assessmentPayload);
    expect(save.status).toBe(201);
    expect(save.body).toHaveProperty("id");

    const list = await request(app).get(`/api/assessments?session_token=${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const row = list.body[0];
    expect(row.candidate_name).toBe("Jane Doe");
    expect(row.dimension_scores.process).toBe(90);
    expect(row.answers[0]).toBe("A1 details");
    expect(row.rubric.resilience.high).toBe("X");
    expect(row.contributions.resilience[0].answer_index).toBe(1);
  });
});
