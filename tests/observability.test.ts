import assert from 'node:assert';
import { generateWithModelFallback } from '../server.js';
import { GoogleGenAI } from '@google/genai';

async function runTest() {
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  let logs: string[] = [];
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
    
    assert.strictEqual(logs.length, 1);
    assert.match(logs[0], /\[Gemini Success\]/);
    assert.match(logs[0], /attempt 1/);
    assert.match(logs[0], /duration=\d+ms/);
    assert.match(logs[0], /model=/);
    assert.doesNotMatch(logs[0], /SECRET_PROMPT/);
    assert.doesNotMatch(logs[0], /Success response/);
    
    console.warn = originalWarn;
    console.info = originalInfo;
    console.error = originalError;
    console.log("Success test passed!");
  } catch(e) {
    console.log("Failed!", e);
  } finally {
    process.exit(0);
  }
}

runTest();
