import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert';
import { apiLogoutUser } from '../src/utils/studentStorage';

describe('Stage 2 Frontend Logout API', () => {
  let originalFetch: typeof fetch;

  afterEach(() => {
    mock.reset();
  });

  test('5. Logout API calls /api/auth/logout with include credentials', async () => {
    let fetchCalledWith: RequestInfo | URL | undefined;
    let fetchOptions: RequestInit | undefined;

    global.fetch = mock.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
      fetchCalledWith = url;
      fetchOptions = options;
      return {
        ok: true,
        json: async () => ({ success: true })
      };
    }) as any;

    const result = await apiLogoutUser();

    assert.strictEqual(result, true, 'logout should return true on success');
    assert.strictEqual(typeof fetchCalledWith === 'string' && fetchCalledWith.includes('/api/auth/logout'), true, 'Should call logout endpoint');
    assert.strictEqual(fetchOptions?.method, 'POST', 'Logout should be a POST request');
    assert.strictEqual(fetchOptions?.credentials, 'include', 'Must include credentials to clear cookie');
  });
});
