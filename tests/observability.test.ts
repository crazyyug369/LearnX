import assert from 'node:assert';
import test from 'node:test';
import { generateWithModelFallback } from '../server.js';
import { GoogleGenAI } from '@google/genai';

test('generateWithModelFallback - success logging is sanitized', async () => {
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  const logs: string[] = [];
  console.info = (msg: string) => logs.push(msg);
  console.warn = (msg: string) => logs.push(msg);
  console.error = (msg: string) => logs.push(msg);

  try {
    const mockAi = {
      models: {
        generateContent: async () => ({ text: 'Success response' })
      }
    } as unknown as GoogleGenAI;

    await generateWithModelFallback(mockAi, { contents: 'SECRET_PROMPT' });
    
    // A local test run may also log the expected database-settings fallback.
    // Assert only on logs emitted by the Gemini fallback layer.
    const geminiLogs = logs.filter((log) => log.includes('[Gemini '));
    assert.strictEqual(geminiLogs.length, 1);
    assert.match(geminiLogs[0], /\[Gemini Success\]/);
    assert.match(geminiLogs[0], /attempt 1/);
    assert.match(geminiLogs[0], /duration=\d+ms/);
    assert.match(geminiLogs[0], /model=/);
    assert.doesNotMatch(geminiLogs[0], /SECRET_PROMPT/);
    assert.doesNotMatch(geminiLogs[0], /Success response/);
    
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  }
});
