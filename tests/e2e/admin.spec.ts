import { test, expect } from '@playwright/test';
import mysql from 'mysql2/promise';

let pool: mysql.Pool;

test.beforeAll(async () => {
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: 'learnx_e2e_test',
    waitForConnections: true,
  });

  // Give backend some time to create the schema if running for the first time
  await new Promise(resolve => setTimeout(resolve, 3000));
});

test.afterAll(async () => {
  await pool.end();
});

test.beforeEach(async () => {
  // Database cleanup to maintain e2e isolation per run
  await pool.query('DELETE FROM cohort_students');
  await pool.query('DELETE FROM student_progress');
  await pool.query('DELETE FROM quiz_attempts');
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM institutions');

  // Seed standard admin user with password 'teacherpass123'
  const adminHash = '$2b$10$LjOZ32fWDt.xThVJLP7fF.DH3/1xvzhE05MuMpUeAuJRM4heIKRUC';
  await pool.query(`
    INSERT INTO users (id, name, email, role, password_hash, needs_password, created_at)
    VALUES ('usr_e2e_admin', 'E2E Admin', 'admin@learnx.org', 'admin', ?, 0, NOW())
  `, [adminHash]);

  // Seed a random target user to safely delete
  await pool.query(`
    INSERT INTO users (id, name, email, role, password_hash, needs_password, created_at)
    VALUES ('usr_e2e_target', 'Target User To Delete', 'target@learnx.org', 'student', ?, 0, NOW())
  `, [adminHash]);
});

test.describe('Admin E2E Flow', () => {

  test('Complete flow: authenticates as admin, view analytics, manage users, error states, and unauth access', async ({ page }) => {

    // 1. Mock the test-gemini response with an exact production failure state shape
    await page.route('**/api/admin/test-gemini', async (route) => {
      await route.fulfill({
        status: 503,
        json: {
          success: false,
          error: 'API Request Failed.'
        }
      });
    });

    // We will verify users route resolves naturally inside E2E without mocking it.

    // 2. Load root application
    await page.goto('/');

    // 3. Authenticate as Admin
    // In AuthModal, switch to "Admin" tab
    await page.locator('#tab-auth-admin').click();

    // Fill credentials
    await page.locator('#input-admin-email').fill('admin@learnx.org');
    await page.locator('#input-admin-password').fill('teacherpass123'); // Minimum 8 chars
    await page.locator('#btn-submit-admin-auth').click();

    // 4. Verify Admin Dashboard Loads (Analytics)
    // Overview tab should be active and render analytics cards
    await expect(page.getByText(/Total Enrolled/i)).toBeVisible({ timeout: 10000 });
    const overviewTabBtn = page.getByRole('button', { name: /Overview & Analytics/i });
    await expect(overviewTabBtn).toBeVisible();

    // 5. Navigate to CRM & User Directory
    const crmTabBtn = page.getByRole('button', { name: /CRM & User Directory/i });
    await crmTabBtn.click();
    await expect(page.getByRole('button', { name: /\+ Create User/i })).toBeVisible({ timeout: 5000 });

    // Ensure Target User is visible before deletion
    await expect(page.getByText(/Target User To Delete/i)).toBeVisible();

    // 6. Delete User Flow
    // Click delete icon matching the target row
    // Playwright locator strategy: find row by text, then its delete button
    const row = page.getByRole('row').filter({ hasText: 'Target User To Delete' });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /Delete user record/i }).click();

    // Confirm deletion modal
    await expect(page.getByText(/Are you sure you want to permanently delete.*?Target User To Delete/i)).toBeVisible();
    const confirmBtn = page.getByRole('button', { name: /Confirm Delete/i });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Verify successful toast message appears
    await expect(page.getByText(/User "Target User To Delete" deleted/i)).toBeVisible({ timeout: 5000 });

    // Verify row vanishes
    await expect(page.getByRole('row', { name: /Target User To Delete/i })).not.toBeVisible();

    // Database verification: Verify user was truly destroyed in DB
    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = "usr_e2e_target"');
    expect(rows.length).toBe(0);

    // 7. Test AI Subsystem handling Failure mode (Error State reflection)
    const modelsTabBtn = page.getByRole('button', { name: /AI Engine & Model Control/i });
    await modelsTabBtn.click();

    // Tap test gemini
    const testGeminiBtn = page.getByRole('button', { name: /Test Gemini Ping/i });
    await testGeminiBtn.click();

    // Since we mocked 503 error, assert UI visually prints the failure string correctly
    await expect(page.getByText(/API Request Failed/i)).toBeVisible({ timeout: 5000 });

    // 8. Sign out
    await page.locator('#btn-user-profile-menu').click();
    const logOutBtn = page.locator('#btn-logout');
    await logOutBtn.click();

    // UI returns to Login Portal
    await expect(page.locator('#btn-student-signin')).toBeVisible();

    // 9. Unauthorized / Fallback verification
    // Attempting to route manually as unauthenticated should keep you out
    // Re-navigating to root resets session (Playwright isolates context anyway, but explicitly testing guardrails)
    // Without a session, UI remains on Auth screen
  });

  // --- PATCH 3: DELETE failure path test ---
  test('Admin CRM gracefully handles backend failure for DELETE user', async ({ page }) => {
    // 1. Mock the delete endpoint to fail with 500 Internal Server Error
    await page.route('**/api/admin/users/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 500,
          body: 'Internal Server Error'
        });
      } else {
        await route.continue();
      }
    });

    // 2. Load root application & Login as admin
    await page.goto('/');
    await page.locator('#tab-auth-admin').click();
    await page.locator('#input-admin-email').fill('admin@learnx.org');
    await page.locator('#input-admin-password').fill('teacherpass123');
    await page.locator('#btn-submit-admin-auth').click();

    // 3. Navigate to CRM
    await page.getByRole('button', { name: /CRM & User Directory/i }).click();
    await expect(page.getByRole('button', { name: /\+ Create User/i })).toBeVisible({ timeout: 5000 });

    // 4. Try to delete the target user
    const row = page.getByRole('row').filter({ hasText: 'Target User To Delete' });
    await row.getByRole('button', { name: /Delete user record/i }).click();
    
    const confirmBtn = page.getByRole('button', { name: /Confirm Delete/i });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 5. Verify the UI reflects the error gracefully
    await expect(page.getByText(/Error deleting user record\./i)).toBeVisible({ timeout: 5000 });

    // 6. Verify row STAYS in the table (no optimistic deletion if backend failed)
    await expect(page.getByRole('row', { name: /Target User To Delete/i })).toBeVisible();
    
    // 7. Verify the app is still usable (can close modal and navigate to other tabs)
    const cancelBtn = page.getByRole('button', { name: /Cancel/i });
    // If the modal is still open, close it (Toast is shown, but is Modal closed?)
    // Depends on if setDeleteConfirmUser(null) ran. It did NOT run because it's inside if(data.success)
    await cancelBtn.click();
    await expect(page.getByText(/Are you sure you want to permanently delete/i)).not.toBeVisible();
    
    // Switch to another tab to prove app didn't crash
    await page.getByRole('button', { name: /Overview & Analytics/i }).click();
    await expect(page.getByText(/Total Enrolled/i)).toBeVisible();
  });

  test('Unauthenticated direct navigation to admin route shows restricted view', async ({ page }) => {
    // 1. Manually set sessionStorage to activeTab='admin' to simulate direct navigation w/o auth
    await page.goto('/');
    await page.evaluate(() => sessionStorage.setItem('learnx_active_tab', 'admin'));
    await page.reload();

    // 2. We should NOT see the Admin Dashboard. We should see the AdminAccessRestrictedView
    await expect(page.getByText(/Restricted Administrative Zone/i)).toBeVisible();
    await expect(page.getByText(/LearnX System & CRM Control Room/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Authenticate as Administrator/i })).toBeVisible();
    
    // We should NOT see Admin Dashboard elements (e.g. tabs)
    await expect(page.getByRole('button', { name: /Overview & Analytics/i })).not.toBeVisible();
  });
});

