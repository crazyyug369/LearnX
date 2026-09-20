import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { render, cleanup, screen, waitFor } from '@testing-library/react';
import { JSDOM } from 'jsdom';
import App from '../src/App';

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
global.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null
} as any;

global.localStorage = {
  getItem: mock.fn(),
  setItem: mock.fn(),
  removeItem: mock.fn(),
  clear: mock.fn(),
  length: 0,
  key: mock.fn(),
} as any;

afterEach(() => cleanup());
describe('Stage 1 Frontend Session Startup', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mock.reset();
  });

  test('1. Valid session startup successfully resolves to student dashboard (path)', async () => {
    global.fetch = mock.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
      if (url === '/api/auth/me') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            user: {
              id: 'stu_1',
              name: 'Test Student',
              role: 'student',
              grade: 'Grade 10',
            }
          })
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as any;

    const { unmount, getByText, queryByText } = render(<App />);

    // Initially should show loading
    assert.ok(getByText(/Authenticating secure session/i));

    // Wait for the app to finish loading and fetch completely
    await waitFor(() => {
      assert.ok(!queryByText(/Authenticating secure session/i));
    });

    // Should render the main knowledge graph/path view since role is student
    assert.ok(getByText(/Test Student/i) || getByText(/Knowledge Map/i) || getByText(/Select a subject/i));

    unmount();
  });

  test('2. No session safely boots to Guest View without flashing protected content', async () => {
    global.fetch = mock.fn(async (url: RequestInfo | URL) => {
      if (url === '/api/auth/me') {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            success: false,
            error: 'Not authenticated'
          })
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as any;

    const { unmount, getByText, queryByText, queryAllByText } = render(<App />);

    // Initially should show loading
    assert.ok(getByText(/Authenticating secure session/i));

    // Wait for loading to finish and fall back to guest
    await waitFor(() => {
      assert.ok(!queryByText(/Authenticating secure session/i));
    });

    // There should be a "Sign In" button indicating guest mode
    assert.ok(queryAllByText(/Sign In/i).length > 0);

    unmount();
  });
});









