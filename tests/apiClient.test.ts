import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert';
import { apiFetch } from '../src/utils/apiClient';

describe('apiClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    mock.restoreAll();
    global.fetch = originalFetch;
  });

  test('apiFetch automatically adds credentials: include', async () => {
    let capturedInit: RequestInit | undefined;

    global.fetch = mock.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ data: 'success' }), { status: 200 });
    });

    await apiFetch('/api/test', { method: 'GET' });

    assert.strictEqual(capturedInit?.credentials, 'include');
  });

  test('apiFetch dispatches auth:unauthorized event on 401 response', async () => {
    // Setup a mock for window.dispatchEvent
    let eventDispatched = false;
    let eventDetail: any = null;

    global.window = {
      dispatchEvent: (event: CustomEvent) => {
        if (event.type === 'auth:unauthorized') {
          eventDispatched = true;
          eventDetail = event.detail;
        }
        return true;
      }
    } as any;

    global.fetch = mock.fn(async () => {
      return new Response('Unauthorized', { status: 401 });
    });

    const response = await apiFetch('/api/restricted');

    assert.strictEqual(response.status, 401);
    assert.strictEqual(eventDispatched, true);
    assert.strictEqual(eventDetail?.message, 'Session expired. Please sign in again.');

    // Cleanup pseudo-window
    delete (global as any).window;
  });

  test('apiFetch does not dispatch auth:unauthorized on 403 response', async () => {
    let eventDispatched = false;

    global.window = {
      dispatchEvent: (event: CustomEvent) => {
        if (event.type === 'auth:unauthorized') {
          eventDispatched = true;
        }
        return true;
      }
    } as any;

    global.fetch = mock.fn(async () => {
      return new Response('Forbidden', { status: 403 });
    });

    const response = await apiFetch('/api/admin-only');

    assert.strictEqual(response.status, 403);
    assert.strictEqual(eventDispatched, false);

    delete (global as any).window;
  });

  test('apiFetch passes successful response through', async () => {
    let eventDispatched = false;

    global.window = {
      dispatchEvent: (event: CustomEvent) => {
        if (event.type === 'auth:unauthorized') {
          eventDispatched = true;
        }
        return true;
      }
    } as any;

    global.fetch = mock.fn(async () => {
      const response = new Response(JSON.stringify({ user: 'test' }), { status: 200 });
      return response;
    });

    const response = await apiFetch('/api/user');
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.user, 'test');
    assert.strictEqual(eventDispatched, false);

    delete (global as any).window;
  });
});
