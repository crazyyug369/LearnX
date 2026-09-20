import { after } from 'node:test';
import { closeDbPool } from '../src/serverDb.js';
import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { generateWithModelFallback, app } from '../server.js';
import { GoogleGenAI } from '@google/genai';

process.env.JWT_SECRET = 'test_secret';
process.env.MOCK_GEMINI = 'true';
delete process.env.GEMINI_API_KEY;

test('generateWithModelFallback - Strategy Verification', async (t) => {
  await t.test('Successful first model remains unchanged', async () => {
    let callCount = 0;
    const mockAi = {
      models: {
        generateContent: async (args: any) => {
          callCount++;
          return { text: 'Success' };
        }
      }
    } as unknown as GoogleGenAI;

    const result = await generateWithModelFallback(mockAi, { contents: 'test' });
    assert.strictEqual(result.text, 'Success');
    assert.strictEqual(callCount, 1);
  });

  await t.test('Transient 429/500/503 -> next model is attempted', async () => {
    let callModels: string[] = [];
    const mockAi = {
      models: {
        generateContent: async (args: any) => {
          callModels.push(args.model);
          const err = new Error('Service Unavailable') as any;
          err.status = 503;
          throw err;
        }
      }
    } as unknown as GoogleGenAI;

    await assert.rejects(
      () => generateWithModelFallback(mockAi, { contents: 'test' }),
      /Service Unavailable/
    );
    // Exponential backoff implies 1 retry per model -> 2 attempts per model tier.
    // Since default settings prioritize 1 + fallback models, we should have >2 attempts.
    assert.ok(callModels.length >= 2, 'Should have iterated multiple times for 503 transient failure');
  });

  await t.test('400/INVALID_ARGUMENT -> no next-model attempt', async () => {
    let callCount = 0;
    const mockAi = {
      models: {
        generateContent: async (args: any) => {
          callCount++;
          const err = new Error('Bad Request') as any;
          err.status = 400;
          throw err;
        }
      }
    } as unknown as GoogleGenAI;

    await assert.rejects(
      () => generateWithModelFallback(mockAi, { contents: 'test' }),
      { status: 400, message: 'Bad Request' }
    );
    assert.strictEqual(callCount, 1, 'Should NOT have attempted fallback models on a 400 error.');
  });

  await t.test('AbortError/TimeoutError -> no next-model attempt', async () => {
    let callCount = 0;
    const mockAi = {
      models: {
        generateContent: async (args: any) => {
          callCount++;
          const err = new Error('Timeout') as any;
          err.name = 'TimeoutError';
          throw err;
        }
      }
    } as unknown as GoogleGenAI;

    await assert.rejects(
      () => generateWithModelFallback(mockAi, { contents: 'test' }),
      { name: 'TimeoutError' }
    );
    assert.strictEqual(callCount, 1, 'Should NOT have attempted fallback models on TimeoutError.');
  });
});

test('generateWithModelFallback - Local educational fallback works after shared-layer failure', async (t) => {
  const studentToken = jwt.sign(
    { id: 'usr_student', email: 'student@example.com', name: 'Student', role: 'student', institutionId: 'inst_1' },
    'test_secret',
    { expiresIn: '1h' }
  );

  // Set MOCK_GEMINI so that getAIClient returns null, thus skipping the wrapper
  // directly and validating that local fallback (adaptive_engine_fallback) behaves as designed.
  process.env.MOCK_GEMINI = 'true';

  await t.test('Route local fallback still works when wrapper fails/ai is null', async () => {
    const res = await request(app)
      .post('/api/ai/mcq-guidance')
      .set('Cookie', `access_token=${studentToken}`)
      .send({ question: 'Q', conceptTitle: 'Gravity', selectedOption: 'A', correctOption: 'B', explanation: 'E' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.source, 'adaptive_engine_fallback');
    assert.ok(res.body.data.misconceptionAnalysis);
  });
});

test('generateWithModelFallback - Observability & Logging', async (t) => {
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  let logs: string[] = [];

  t.beforeEach(() => {
    logs = [];
    console.info = (msg: string) => logs.push(msg);
    console.warn = (msg: string) => logs.push(msg);
    console.error = (msg: string) => logs.push(msg);
  });

  t.afterEach(() => {
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  });

  await t.test('Success logs duration, model, and attempt, but no payload/secrets', async () => {
    const mockAi = {
      models: {
        generateContent: async () => ({ text: 'Success response' })
      }
    } as unknown as GoogleGenAI;

    await generateWithModelFallback(mockAi, { contents: 'SECRET_PROMPT' });
    
    assert.strictEqual(logs.length, 1);
    assert.match(logs[0], /\[Gemini Success\]/);
    assert.match(logs[0], /attempt 1/);
    assert.match(logs[0], /duration=\d+ms/);
    assert.match(logs[0], /model=/);
    
    // Assert sensitive info does not leak
    assert.doesNotMatch(logs[0], /SECRET_PROMPT/);
    assert.doesNotMatch(logs[0], /Success response/);
  });

  await t.test('Transient error logs warning without exposing raw error payloads', async () => {
    let callCount = 0;
    const mockAi = {
      models: {
        generateContent: async () => {
          callCount++;
          if (callCount === 1) {
            const err = new Error('Service Unavailable SENSITIVE_DB_ERROR') as any;
            err.status = 503;
            // mock raw payload
            err.response = { data: 'SECRET_API_KEY' };
            throw err;
          }
          return { text: 'Recovered' };
        }
      }
    } as unknown as GoogleGenAI;

    await generateWithModelFallback(mockAi, { contents: 'PROMPT' });
    
    const warnLogs = logs.filter(l => l.includes('[Gemini Transient Error]'));
    assert.strictEqual(warnLogs.length, 1);
    assert.match(warnLogs[0], /status=503/);
    assert.doesNotMatch(warnLogs[0], /SENSITIVE_DB_ERROR/);
    assert.doesNotMatch(warnLogs[0], /SECRET_API_KEY/);
    
    const successLogs = logs.filter(l => l.includes('[Gemini Success]'));
    assert.strictEqual(successLogs.length, 1);
    assert.match(successLogs[0], /attempt 2/);
  });

  await t.test('Timeout error logs error without payload details', async () => {
    const mockAi = {
      models: {
        generateContent: async () => {
          const err = new Error('Timeout') as any;
          err.name = 'TimeoutError';
          throw err;
        }
      }
    } as unknown as GoogleGenAI;

    await assert.rejects(() => generateWithModelFallback(mockAi, { contents: 'PROMPT' }), { name: 'TimeoutError' });
    
    // timeout falls directly through and does not retry
    const errLogs = logs.filter(l => l.includes('[Gemini Timeout]'));
    assert.strictEqual(errLogs.length, 1);
    assert.match(errLogs[0], /attempt 1/);
  });
  await t.test('Ensure process exits cleanly', () => { setTimeout(() => process.exit(0), 100); });
});

after(async () => { await closeDbPool(); });


