import test, { describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { render, cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { JSDOM } from 'jsdom';
import { AITutorChat } from '../src/components/AITutorChat';
import { ConceptNode } from '../src/types';

// Setup JSDOM
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
});
global.window = dom.window as any;
global.document = dom.window.document as any;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;
Object.defineProperty(global, 'navigator', {
  value: dom.window.navigator,
  writable: true
});

// Mock localStorage with actual in-memory implementation for isolation tests
let store: Record<string, string> = {};
global.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null
} as any;

global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value.toString(); },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { store = {}; },
  length: 0,
  key: () => null
} as any;

afterEach(() => cleanup());
describe('AI Tutor Chat Session Persistence', () => {
  beforeEach(() => {
    store = {};
    // ensure inner components don't scroll Into View and throw error in jsdom
    global.window.HTMLElement.prototype.scrollIntoView = () => {};
    // mock apiFetch to avoid network calls during chat interaction
    const originalFetch = global.fetch;
    global.fetch = async () => {
      return { ok: true, json: async () => ({ success: true, reply: "AI Test Reply" }) } as Response;
    };
  });

  const mockConcept: any = {
    id: 'test-1',
    title: 'Variables',
    description: 'intro',
    status: 'locked'
  };

  test('Persists conversation to localStorage and restores on new mount', async () => {
    // Mount first time
    const { unmount, container } = render(
      <AITutorChat concept={mockConcept} interest="Cricket & Sports" studentId="student_123" />
    );

    // Simulate clicking a quick prompt which bypasses the text input validation
    const promptBtn = container.querySelector('#quick-prompt-0') as HTMLButtonElement;
    fireEvent.click(promptBtn);

    await waitFor(() => {
      const text = container.textContent;
      assert.ok(text?.includes('Explain with a Cricket & Sports analogy'));
    });

    // Check localStorage was written
    const chatData = store['learnx_tutor_chat_student_123'];
    assert.ok(chatData, 'Chat data should be in localStorage');
    const parsedData = JSON.parse(chatData);
    assert.ok(parsedData.some((msg: any) => msg.text === 'Explain with a Cricket & Sports analogy'));

    unmount();

    // Mount again with same studentId, should restore
    const { container: container2 } = render(
      <AITutorChat concept={mockConcept} interest="Cricket & Sports" studentId="student_123" />
    );

    // It should immediately contain the previously sent message
    const text2 = container2.textContent;
    assert.ok(text2?.includes('Explain with a Cricket & Sports analogy'), 'Message should be restored from localStorage');
  });

  test('Isolates conversations between different students', async () => {
    store['learnx_tutor_chat_student_A'] = JSON.stringify([{
      id: '1', sender: 'user', text: 'Message from A', timestamp: 'Just now'
    }]);

    store['learnx_tutor_chat_student_B'] = JSON.stringify([{
      id: '2', sender: 'user', text: 'Message from B', timestamp: 'Just now'
    }]);

    const { container: containerA } = render(
      <AITutorChat concept={mockConcept} interest="Cricket" studentId="student_A" />
    );
    assert.ok(containerA.textContent?.includes('Message from A'));
    assert.ok(!containerA.textContent?.includes('Message from B'));

    const { container: containerB } = render(
      <AITutorChat concept={mockConcept} interest="Cricket" studentId="student_B" />
    );
    assert.ok(containerB.textContent?.includes('Message from B'));
    assert.ok(!containerB.textContent?.includes('Message from A'));
  });

  test('Handles malformed JSON gracefully', async () => {
    // Put broken JSON in storage
    store['learnx_tutor_chat_student_123'] = '{ broken_json: tr';

    const { container } = render(
      <AITutorChat concept={mockConcept} interest="Cooking" studentId="student_123" />
    );

    const text = container.textContent;
    // Should fallback to default welcome message without throwing
    assert.ok(text?.includes('Hello! I am your personal tutor'));
    assert.ok(text?.includes('Cooking'));
  });

  test('Clears history on reset chat', async () => {
    store['learnx_tutor_chat_student_123'] = JSON.stringify([
      { id: '1', sender: 'user', text: 'Old Message', timestamp: 'Just now' }
    ]);

    const { container } = render(
      <AITutorChat concept={mockConcept} interest="Soccer" studentId="student_123" />
    );

    assert.ok(container.textContent?.includes('Old Message'));

    const resetBtn = container.querySelector('#btn-reset-chat');
    fireEvent.click(resetBtn!);

    await waitFor(() => {
      assert.ok(!container.textContent?.includes('Old Message'), 'Old message should be gone');
      assert.ok(container.textContent?.includes('Hello! I am your personal tutor'));

      const storedItem = store['learnx_tutor_chat_student_123'];
      if (storedItem) {
        const parsed = JSON.parse(storedItem);
        assert.equal(parsed.length, 1);
        assert.equal(parsed[0].sender, 'ai');
      } else {
        assert.ok(!storedItem, 'Storage item might be removed completely');
      }
    });
  });
});









