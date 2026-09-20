import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test_secret';
process.env.MOCK_GEMINI = 'true';
delete process.env.GEMINI_API_KEY;

import { app } from '../server.js';
import { closeDbPool } from '../src/serverDb.js';
import { after } from 'node:test';
import {
  adaptiveLessonOutputSchema,
  generateQuestionOutputSchema,
  mcqGuidanceOutputSchema,
  teacherWorksheetOutputSchema,
  curriculumSuggestionOutputSchema
} from '../src/schemas/ai-output.js';

test('AI Zod Schemas - Valid Output', async (t) => {
  await t.test('mcqGuidanceOutputSchema validates correct payload', () => {
    const validGuidance = {
      misconceptionAnalysis: 'Analysis',
      stepByStepCorrection: ['Step 1'],
      keyFormulaLatex: 'F=ma',
      formulaName: 'Newton',
      socraticHint: 'Hint',
      interestAnalogy: 'Analogy',
      encouragingNote: 'Note'
    };
    const result = mcqGuidanceOutputSchema.parse(validGuidance);
    assert.deepStrictEqual(result, validGuidance);
  });

  await t.test('teacherWorksheetOutputSchema validates correct payload', () => {
    const validWorksheet = {
      concept: 'Concept',
      problemStatementId: 207,
      date: 'today',
      sectionA: { title: 'A', analogy: 'Analogy' },
      sectionB: { title: 'B', problems: [{ number: 1, tag: 'Tag', prompt: 'Prompt', answer: 'Ans' }] },
      answerKey: 'Key'
    };
    const result = teacherWorksheetOutputSchema.parse(validWorksheet);
    assert.deepStrictEqual(result, validWorksheet);
  });
  await t.test('adaptiveLessonOutputSchema validates correct payload', () => {
    const validAdaptiveLesson = {
      title: "Title",
      coreConcept: "Core Concept",
      interestAnalogy: "Analogy",
      keyTakeaways: ["Point 1", "Point 2"],
      microExample: "Example",
      checkYourUnderstanding: {
        question: "Q",
        hint: "H",
        answer: "A"
      },
      strategyNote: "Note"
    };
    const result = adaptiveLessonOutputSchema.parse(validAdaptiveLesson);
    assert.deepStrictEqual(result, validAdaptiveLesson);
  });

  await t.test('generateQuestionOutputSchema validates correct payload', () => {
    const validQuestion = {
      question: "Q",
      options: ["A", "B", "C", "D"],
      correctIndex: 0,
      explanation: "Expl",
      hint: "Hint",
      conceptTested: "Concept"
    };
    const result = generateQuestionOutputSchema.parse(validQuestion);
    assert.deepStrictEqual(result, validQuestion);
  });
  await t.test('curriculumSuggestionOutputSchema validates correct payload', () => {
    const validSuggestion = {
      category: 'Category',
      difficulty: 'Beginner',
      prerequisites: ['Pre1'],
      nextConcepts: ['Next1'],
      tags: ['Tag1'],
      estimatedTimeMin: 25,
      description: 'Description',
      pedagogicalRationale: 'Rationale'
    };
    const result = curriculumSuggestionOutputSchema.parse(validSuggestion);
    assert.deepStrictEqual(result, validSuggestion);
  });

});

test('AI Zod Schemas - Rejects Malformed Output', async (t) => {
  await t.test('mcqGuidanceOutputSchema rejects missing required field', () => {
    const malformed = {
      stepByStepCorrection: ['Step 1'],
      keyFormulaLatex: 'F=ma',
      formulaName: 'Newton',
      socraticHint: 'Hint',
      interestAnalogy: 'Analogy',
      encouragingNote: 'Note'
    };
    assert.throws(() => mcqGuidanceOutputSchema.parse(malformed), (err: any) => err.name === 'ZodError');
  });

  await t.test('teacherWorksheetOutputSchema rejects structurally invalid json but syntactically valid', () => {
    const malformed = {
      concept: 'Concept',
      problemStatementId: 207,
      date: 'today',
      sectionA: { title: 'A' }, // Missing analogy
      sectionB: { title: 'B', problems: [{ number: 1, tag: 'Tag', prompt: 'Prompt', answer: 'Ans' }] },
      answerKey: 'Key'
    };
    assert.throws(() => teacherWorksheetOutputSchema.parse(malformed), (err: any) => err.name === 'ZodError');
  });
  await t.test('adaptiveLessonOutputSchema rejects missing nested required field', () => {
    const malformed = {
      title: "Title",
      coreConcept: "Core Concept",
      interestAnalogy: "Analogy",
      keyTakeaways: ["Point 1", "Point 2"],
      microExample: "Example",
      checkYourUnderstanding: {
        question: "Q",
        hint: "H"
        // missing answer
      },
      strategyNote: "Note"
    };
    assert.throws(() => adaptiveLessonOutputSchema.parse(malformed), (err: any) => err.name === "ZodError");
  });

  await t.test('generateQuestionOutputSchema rejects missing options array', () => {
    const malformed = {
      question: "Q",
      correctIndex: 0,
      explanation: "Expl",
      hint: "Hint",
      conceptTested: "Concept"
    };
    assert.throws(() => generateQuestionOutputSchema.parse(malformed), (err: any) => err.name === "ZodError");
  });

  await t.test('generateQuestionOutputSchema rejects wrong primitive type', () => {
    const malformed = {
      question: "Q",
      options: ["A", "B", "C", "D"],
      correctIndex: "0", // Should be number
      explanation: "Expl",
      hint: "Hint",
      conceptTested: "Concept"
    };
    assert.throws(() => generateQuestionOutputSchema.parse(malformed), (err: any) => err.name === "ZodError");
  });

  await t.test('generateQuestionOutputSchema rejects invalid correctIndex', () => {
    const malformed = {
      question: "Q",
      options: ["A", "B", "C", "D"],
      correctIndex: -1, // Should be >= 0
      explanation: "Expl",
      hint: "Hint",
      conceptTested: "Concept"
    };
    assert.throws(() => generateQuestionOutputSchema.parse(malformed), (err: any) => err.name === "ZodError");
  });
  await t.test('curriculumSuggestionOutputSchema rejects wrong primitive type', () => {
    const malformed = {
      difficulty: 'Beginner',
      estimatedTimeMin: '25'
    };
    assert.throws(() => curriculumSuggestionOutputSchema.parse(malformed), (err: any) => err.name === 'ZodError');
  });

  await t.test('curriculumSuggestionOutputSchema rejects malformed array', () => {
    const malformed = {
      prerequisites: 'Not an array'
    };
    assert.throws(() => curriculumSuggestionOutputSchema.parse(malformed), (err: any) => err.name === 'ZodError');
  });

});

test('Endpoints - Use Safe Fallbacks on Missing AI/Malformed JSON', async (t) => {
  const studentToken = jwt.sign(
    { id: 'usr_student', email: 'student@example.com', name: 'Student', role: 'student', institutionId: 'inst_1' },
    'test_secret',
    { expiresIn: '1h' }
  );
  await t.test('mcq-guidance fallback works', async () => {
    const res = await request(app)
      .post('/api/ai/mcq-guidance')
      .set('Cookie', `access_token=${studentToken}`)
      .send({ question: 'Q', conceptTitle: 'Gravity', selectedOption: 'A', correctOption: 'B', explanation: 'E' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.source, 'adaptive_engine_fallback');
    assert.ok(res.body.data.misconceptionAnalysis);
  });

  await t.test('worksheet-generate fallback works', async () => {
    const teacherToken = jwt.sign(
      { id: 'usr_teacher', email: 'teacher@example.com', name: 'Teacher', role: 'teacher', institutionId: 'inst_1' },
      'test_secret',
      { expiresIn: '1h' }
    );
    const res = await request(app)
      .post('/api/teacher/worksheet/generate')
      .set('Cookie', `access_token=${teacherToken}`)
      .send({ conceptTitle: 'quadratic', subject: 'Math', grade: 'Grade 10' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.worksheet.concept, 'quadratic');
    assert.ok(res.body.worksheet.sectionB.problems.length > 0);
  });

  // We do not have GEMINI_API_KEY in the test environment, but we must set MOCK_GEMINI='true'
  // to allow the routes to safely fall back.
  process.env.MOCK_GEMINI = 'true';
  process.env.JWT_SECRET = 'test_secret';

  await t.test('adaptive-lesson fallback works', async () => {
    const res = await request(app)
      .post('/api/ai/adaptive-lesson')
      .set('Cookie', `access_token=${studentToken}`)
      .send({ concept: 'Gravity', subject: 'Physics', interest: 'Cricket' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    // The fallback logic returns hardcoded JSON-like structure
    assert.ok(res.body.data.title.includes('Gravity') || res.body.data.interestAnalogy.includes('cricket'));
  });

  await t.test('generate-question fallback works', async () => {
    const res = await request(app)
      .post('/api/ai/generate-question')
      .set('Cookie', `access_token=${studentToken}`)
      .send({ concept: 'Gravity', subject: 'Physics', interest: 'Cricket' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.source, 'fallback');
    assert.ok(res.body.data.options.length > 0);
  });
  await t.test('curriculum ai-suggest fallback works', async () => {
    const teacherToken = jwt.sign(
      { id: 'usr_teacher', email: 'teacher@example.com', name: 'Teacher', role: 'teacher', institutionId: 'inst_1' },
      'test_secret',
      { expiresIn: '1h' }
    );
    const res = await request(app)
      .post('/api/curriculum/ai-suggest')
      .set('Cookie', `access_token=${teacherToken}`)
      .send({ title: 'Gravity', subject: 'Physics', grade: 'Grade 10' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.source, 'ncert_curriculum_dag');
    assert.strictEqual(res.body.data.estimatedTimeMin, 25);
  });
});

after(async () => { await closeDbPool(); });

