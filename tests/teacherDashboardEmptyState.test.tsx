import test, { describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { render, cleanup, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { JSDOM } from 'jsdom';
import { TeacherDashboard } from '../src/components/TeacherDashboard';

// Setup JSDOM
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
global.window = dom.window as any;
global.document = dom.window.document as any;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;
global.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null
} as any;

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null
} as any;

afterEach(() => cleanup());
test('TeacherDashboard Empty State Handling', async (t) => {
  // Mock global.fetch to return empty bottlenecks and students
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (url === '/api/students') {
      return { ok: true, json: async () => ({ success: true, students: [] }) } as Response;
    }
    if (url === '/api/teacher/analytics/bottlenecks') {
      return { ok: true, json: async () => ({ success: true, bottlenecks: [], velocityGain: null, atRiskCount: null }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  };

  await t.test('Does not render mock data when backend responds with empty arrays', async () => {
    const { container } = render(
      <TeacherDashboard
        currentUser={{ id: 'teach_1', name: 'Test Teacher', role: 'teacher', grade: 'Class 10', institutionId: 'inst_1' }}
        activeSection='overview'
      />
    );

    // Wait for the fetch and state updates to settle
    await waitFor(() => {
      // It should display '0 Concepts' under bottlenecks
      const text = container.textContent;
      assert.ok(!text?.includes('Quadratic Equations'), 'Mock at-risk concept should not appear');
      assert.ok(!text?.includes('73.4%'), 'Mock mastery percentage should not appear');
      assert.ok(!text?.includes('+38%'), 'Mock velocity gain of 38 should not appear');
      assert.ok(text?.includes('Insufficient data'), 'Should display Insufficient data for null velocity gain');
      assert.ok(text?.includes('0 Concepts'), 'Should display 0 concepts instead of mock length');
      assert.ok(text?.includes('No active bottlenecks'), 'Should show the empty state message');
    });
  });

  global.fetch = originalFetch;
});






import { after } from 'node:test';
after(() => dom.window.close());





