import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { JSDOM } from 'jsdom';
import { AuthModal } from '../src/components/AuthModal';

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
describe('Stage 2 Frontend Auth Forms Integration', () => {
  let originalFetch: typeof fetch;
  const mockOnClose = mock.fn();
  const mockOnLogin = mock.fn();

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mock.reset();
    mockOnClose.mock.resetCalls();
    mockOnLogin.mock.resetCalls();
  });

  test('1. Successful student login and post-login refresh', async () => {
    global.fetch = mock.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
      // Mock login endpoint
      if (typeof url === 'string' && url.includes('/api/auth/login')) {
        return {
          ok: true,
          json: async () => ({ success: true, user: { id: 'stu_1', role: 'student', name: 'Test Student' } })
        };
      }
      // Mock refresh endpoint
      if (typeof url === 'string' && url.includes('/api/auth/me')) {
        return {
          ok: true,
          json: async () => ({ success: true, user: { id: 'stu_1', role: 'student', name: 'Verified Student' } })
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as any;

    const { unmount, getByLabelText, getByRole, getByText } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} onLogin={mockOnLogin} initialRole="student" />
    );

    // Enter credentials
    const emailInput = document.getElementById('input-student-email') as HTMLInputElement;
    const pwdInput = document.getElementById('input-student-password') as HTMLInputElement;

    // Simulate user typing
    fireEvent.change(emailInput, { target: { value: 'test@student.learnx.org' } });
    fireEvent.change(pwdInput, { target: { value: 'password123' } });

    // Submit form
    const submitBtn = document.getElementById('btn-submit-student-auth');
    assert.ok(submitBtn, 'Submit button should exist');
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      assert.strictEqual(mockOnLogin.mock.callCount(), 1, 'onLogin should be called once');
      const loginPayload = mockOnLogin.mock.calls[0].arguments[0];
      assert.strictEqual(loginPayload.name, 'Verified Student', 'Should pass verified user from refresh to onLogin');
      assert.strictEqual(mockOnClose.mock.callCount(), 1, 'onClose should be called');
    });

    unmount();
  });

  test('2. Failed login shows error message', async () => {
    global.fetch = mock.fn(async (url: RequestInfo | URL) => {
      if (typeof url === 'string' && url.includes('/api/auth/login')) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ success: false, error: 'Invalid credentials' })
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as any;

    const { unmount, getByText, queryByText } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} onLogin={mockOnLogin} initialRole="student" />
    );

    const emailInput = document.getElementById('input-student-email') as HTMLInputElement;
    const pwdInput = document.getElementById('input-student-password') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'test@student.learnx.org' } });
    fireEvent.change(pwdInput, { target: { value: 'wrongpassword' } });

    const submitBtn = document.getElementById('btn-submit-student-auth');
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      assert.ok(getByText('Invalid credentials'), 'Error message should be rendered');
      assert.strictEqual(mockOnLogin.mock.callCount(), 0, 'onLogin should not be called');
    });

    unmount();
  });

  test('3. Account claim transitions authMode and handles setup', async () => {
    let loginAttempts = 0;
    global.fetch = mock.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
      if (typeof url === 'string') {
        if (url.includes('/api/auth/login')) {
          // Attempting login triggers needsClaim
          if (loginAttempts === 0) {
            loginAttempts++;
            return {
              ok: false,
              status: 403,
              json: async () => ({ success: false, error: 'Password required', needsClaim: true })
            };
          }
          return {
            ok: true,
            json: async () => ({ success: true, user: { id: 'stu_1', role: 'student', name: 'Claimed Student' } })
          };
        }
        if (url.includes('/api/auth/claim-password')) {
          return { ok: true, json: async () => ({ success: true }) };
        }
        if (url.includes('/api/auth/me')) {
          return {
            ok: true,
            json: async () => ({ success: true, user: { id: 'stu_1', role: 'student', name: 'Claimed Student' } })
          };
        }
      }
      return { ok: true, json: async () => ({}) };
    }) as any;

    const { unmount, getByText, queryByText } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} onLogin={mockOnLogin} initialRole="student" />
    );

    const emailInput = document.getElementById('input-student-email') as HTMLInputElement;
    const pwdInput = document.getElementById('input-student-password') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'legacy@student.learnx.org' } });
    // This is technically dummy data since legacy didn't have password, but they try to log in somehow
    fireEvent.change(pwdInput, { target: { value: 'trigger' } });

    const submitBtn = document.getElementById('btn-submit-student-auth');
    fireEvent.click(submitBtn!);

    // Wait for transition to claim_account UI
    await waitFor(() => {
      assert.ok(getByText('Security Update Required'));
    });

    // Now in claim mode
    const claimPwdInput = document.getElementById('input-claim-password') as HTMLInputElement;
    fireEvent.change(claimPwdInput, { target: { value: 'securepassword123' } });

    const submitClaimBtn = document.getElementById('btn-submit-claim-account');
    fireEvent.click(submitClaimBtn!);

    await waitFor(() => {
      assert.strictEqual(mockOnLogin.mock.callCount(), 1, 'Should login automatically after claiming account');
      assert.strictEqual(mockOnClose.mock.callCount(), 1, 'Modal should close after successful claim login');
    });

    unmount();
  });

  test('4. Successful student registration', async () => {
    global.fetch = mock.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
      if (typeof url === 'string') {
        if (url.includes('/api/auth/register')) {
          return {
            ok: true,
            json: async () => ({ success: true, user: { id: 'stu_new', role: 'student', name: 'New Student' }, isNew: true })
          };
        }
        if (url.includes('/api/auth/me')) {
          return {
            ok: true,
            json: async () => ({ success: true, user: { id: 'stu_new', role: 'student', name: 'New Student' }, isNew: true })
          };
        }
      }
      return { ok: true, json: async () => ({}) };
    }) as any;

    const { unmount, getByText, getByRole, queryByText } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} onLogin={mockOnLogin} initialRole="student" />
    );

    // Switch to signup mode
    const signUpTab = getByText('Create Student Account');
    fireEvent.click(signUpTab);

    await waitFor(() => {
      assert.ok(queryByText('Student Full Name'), 'Name field should appear');
    });

    const nameInput = document.getElementById('input-student-name') as HTMLInputElement;
    const emailInput = document.getElementById('input-student-email') as HTMLInputElement;
    const pwdInput = document.getElementById('input-student-password') as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: 'New Student' } });
    fireEvent.change(emailInput, { target: { value: 'new@student.learnx.org' } });
    fireEvent.change(pwdInput, { target: { value: 'password123' } });

    const submitBtn = document.getElementById('btn-submit-student-auth');
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      assert.strictEqual(mockOnLogin.mock.callCount(), 1, 'onLogin should be called once');
      const loginPayload = mockOnLogin.mock.calls[0].arguments[0];
      assert.strictEqual(loginPayload.name, 'New Student', 'Should pass new user from refresh to onLogin');

      const isNewStudentFlag = mockOnLogin.mock.calls[0].arguments[2];
      assert.strictEqual(isNewStudentFlag, true, 'isNewStudent flag should be true');

      assert.strictEqual(mockOnClose.mock.callCount(), 1, 'onClose should be called');
    });

    unmount();
  });
});




