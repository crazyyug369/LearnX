import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../server.js';
import { closeDbPool } from '../src/serverDb.js';
import { after } from 'node:test';

process.env.JWT_SECRET = 'test_secret';
process.env.MOCK_GEMINI = 'false';
process.env.GEMINI_API_KEY = 'fake_key';

test('Teacher Worksheet Generation - AI & Resilience', async (t) => {
  const teacherToken = jwt.sign(
    { id: 'usr_teacher', email: 'teacher@example.com', name: 'Teacher', role: 'teacher', institutionId: 'inst_1' },
    'test_secret',
    { expiresIn: '1h' }
  );

  let originalFetch: typeof global.fetch;

  t.beforeEach(() => {
    originalFetch = global.fetch;
  });

  t.afterEach(() => {
    global.fetch = originalFetch;
  });

  await t.test('Successful generation preserves API shape', async () => {
    global.fetch = async (input, init) => {
      const validWorksheet = {
        concept: "Mock Quadratic",
        problemStatementId: 404,
        date: "2026-09-19",
        sectionA: { title: "Title A", analogy: "Analogy A" },
        sectionB: { title: "Title B", problems: [{ number: 1, tag: "Mock", prompt: "Mock Prompt", answer: "Mock Answer" }] },
        answerKey: "Mock Key"
      };
      
      const responseBody = {
        candidates: [{
          content: { parts: [{ text: JSON.stringify(validWorksheet) }] }
        }]
      };

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const res = await request(app)
      .post('/api/teacher/worksheet/generate')
      .set('Cookie', `access_token=${teacherToken}`)
      .send({ conceptTitle: 'quadratic equations', subject: 'Math', grade: 'Grade 10' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.worksheet.concept, 'Mock Quadratic', 'Worksheet concept matches mock');
    assert.strictEqual(res.body.worksheet.sectionB.problems[0].tag, 'Mock');
  });

  await t.test('Timeout error reaches buildCuratedWorksheet fallback', async () => {
    global.fetch = async (input, init) => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    };

    const res = await request(app)
      .post('/api/teacher/worksheet/generate')
      .set('Cookie', `access_token=${teacherToken}`)
      .send({ conceptTitle: 'Timeout Concept', subject: 'Math', grade: 'Grade 10' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.worksheet.concept, 'Timeout Concept', 'Should use fallback values');
    // existing fallback provides hardcoded structure
    assert.ok(res.body.worksheet.sectionB.problems.length > 0);
  });

  await t.test('Malformed JSON still reaches the existing fallback', async () => {
    global.fetch = async (input, init) => {
      const responseBody = {
        candidates: [{
          content: { parts: [{ text: "{ malformed json" }] }
        }]
      };

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const res = await request(app)
      .post('/api/teacher/worksheet/generate')
      .set('Cookie', `access_token=${teacherToken}`)
      .send({ conceptTitle: 'Malformed Concept', subject: 'Math', grade: 'Grade 10' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.worksheet.concept, 'Malformed Concept');
    assert.ok(res.body.worksheet.sectionB.problems.length > 0);
  });

  await t.test('Zod-invalid worksheet output still reaches the existing fallback', async () => {
    global.fetch = async (input, init) => {
      // valid JSON, but missing required field 'answerKey' and 'problemStatementId'
      const invalidWorksheet = {
        concept: "Partial",
        date: "2026-09-19",
        sectionA: { title: "Title A", analogy: "Analogy A" },
        sectionB: { title: "Title B", problems: [] }
      };

      const responseBody = {
        candidates: [{
          content: { parts: [{ text: JSON.stringify(invalidWorksheet) }] }
        }]
      };

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const res = await request(app)
      .post('/api/teacher/worksheet/generate')
      .set('Cookie', `access_token=${teacherToken}`)
      .send({ conceptTitle: 'Zod Invalid Concept', subject: 'Math', grade: 'Grade 10' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.worksheet.concept, 'Zod Invalid Concept');
    assert.ok(res.body.worksheet.sectionB.problems.length > 0);
  });
});

after(async () => { await closeDbPool(); });

