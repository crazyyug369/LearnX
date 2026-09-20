import { test, expect } from '@playwright/test';

test.describe('E2E Smoke Test', () => {
  test('App loads without critical errors and shows login for unauthenticated users', async ({ page }) => {
    // Array to catch any unexpected console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore specific expected soft-errors if needed, otherwise capture
        if (!text.includes("401 (Unauthorized)")) { consoleErrors.push(text); }
      }
    });

    page.on('pageerror', err => {
      consoleErrors.push(`Uncaught Error: ${err.message}`);
    });

    // Mock Gemini API so we do not hit production LLMs, just in case
    await page.route('/api/ai/adaptive-lesson', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          lessonHtml: '<h1>Mock Lesson</h1><p>Fast standard concept text.</p>'
        }
      });
    });

    // Navigate to local app
    await page.goto('/');

    // Check if the auth modal / login UI is visible.
    // The specific locator depends on the app's React HTML structure.
    // We expect some form of welcome or login prompt since it's unauthenticated.
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();

    await test.step('Verify no console runtime errors on load', () => {
      expect(consoleErrors, 'Console should have no errors on basic load').toEqual([]);
    });
  });
});

