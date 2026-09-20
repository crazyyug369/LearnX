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

  await new Promise(resolve => setTimeout(resolve, 3000));
});

test.afterAll(async () => {
  await pool.end();
});

test.beforeEach(async () => {
  await pool.query('DELETE FROM cohort_students');
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM student_progress');
  await pool.query('DELETE FROM quiz_attempts');
  await pool.query('DELETE FROM curriculum_nodes');
  await pool.query('DELETE FROM institutions');

  // Seed institution
  await pool.query(`
    INSERT INTO institutions (id, code, name, email)
    VALUES ('inst_1', 'INST1', 'E2E Institution', 'admin@inst1.org')
  `);

  // Seed teacher user ('teacherpass123')
  const teacherHash = '$2b$10$LjOZ32fWDt.xThVJLP7fF.DH3/1xvzhE05MuMpUeAuJRM4heIKRUC';
  await pool.query(`
    INSERT INTO users (id, name, email, role, password_hash, needs_password, institution_id, created_at)
    VALUES ('usr_e2e_teacher', 'E2E Demo Teacher', 'teacher@learnx.org', 'teacher', ?, 0, 'inst_1', NOW())
  `, [teacherHash]);

  // Seed student user linked to same institution
  await pool.query(`
    INSERT INTO users (id, name, email, role, password_hash, needs_password, institution_id, created_at)
    VALUES ('usr_e2e_student2', 'E2E Linked Student', 'student@learnx.org', 'student', ?, 0, 'inst_1', NOW())
  `, [teacherHash]);
});

test.describe('Teacher E2E Flow', () => {
  test('Complete flow: authenticates as teacher, accesses dashboard, and assigns practice', async ({ page }) => {

    // 1. Mock the bottleneck analytics API with deterministic struggling-learner data
    await page.route('**/api/teacher/analytics/bottlenecks', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          bottlenecks: [
            {
              concept: 'Mock Struggling Concept',
              failureRate: 75,
              recommendedAction: 'Assign Practice Set',
              affectedLearnersCount: 2
            }
          ],
          velocityGain: 12.5,
          atRiskCount: 2
        }
      });
    });

    // We don't strictly need to mock deploy, but I will mock the worksheet generator just in case it is triggered
    await page.route('**/api/teacher/worksheet/generate', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          worksheet: {
            concept: 'Mock Struggling Concept',
            problemStatementId: 207,
            date: '2026-09-19',
            sectionA: {
              title: 'Section A: Visual & Intuitive Scaffold',
              analogy: 'Mock intuitive explanation connecting abstract formulas to physical analogies'
            },
            sectionB: {
              title: 'Section B: Guided Practice Problems',
              problems: [
                {
                  number: 1,
                  tag: 'Stepping Stone (Prerequisite)',
                  prompt: 'Mock Problem 1 Statement',
                  answer: 'Mock Solution 1'
                }
              ]
            },
            answerKey: 'Mock Answer Key'
          }
        }
      });
    });

    // 2. Load application
    await page.goto('/');

    // 3. Authenticate as the teacher using the real existing teacher authentication flow
    // In AuthModal, switch to "Teacher" tab
    await page.locator('#tab-auth-teacher').click();

    // Fill form
    await page.locator('#input-teacher-email').fill('teacher@learnx.org');
    await page.locator('#input-teacher-password').fill('teacherpass123');

    await page.locator('#btn-submit-teacher-auth').click();

    // 4. Verify the application enters Teacher/Educator mode by checking for dashboard elements
    const overviewTab = page.locator('#tab-btn-teacher-overview');
    await expect(overviewTab).toBeVisible({ timeout: 10000 });

    // 5. Verify the Teacher Dashboard is accessible and contains all exact tabs
    const rosterTab = page.locator('#tab-btn-teacher-roster');
    const interventionsTab = page.locator('#tab-btn-teacher-interventions');
    const curriculumTab = page.locator('#tab-btn-teacher-curriculum');

    await expect(overviewTab).toBeVisible();
    await expect(rosterTab).toBeVisible();
    await expect(interventionsTab).toBeVisible();
    await expect(curriculumTab).toBeVisible();

    // 6. Verify the seeded student appears in the teacher's roster
    await rosterTab.click();
    await expect(page.getByText(/E2E Linked Student/i)).toBeVisible({ timeout: 5000 });

    // 7. Navigate to Interventions
    await interventionsTab.click();

    // 8. Test Remedial Worksheet Generation
    const generateBtn = page.getByRole('button', { name: /Generate Remedial Worksheet/i }).first();
    await expect(generateBtn).toBeVisible({ timeout: 5000 });
    await generateBtn.click();

    // 8a. Verify the modal opens and renders the mocked AI response correctly
    const worksheetTitle = page.getByText(/LearnX Practice & Revision Worksheet/i);
    await expect(worksheetTitle).toBeVisible({ timeout: 5000 });

    const sectionAContent = page.getByText(/Mock intuitive explanation connecting abstract formulas/i);
    await expect(sectionAContent).toBeVisible();

    const problem1Prompt = page.getByText(/Mock Problem 1 Statement/i);
    await expect(problem1Prompt).toBeVisible();

    // 8b. Close the modal to proceed with practice assignment
    const closeBtn = page.getByRole('button', { name: /Close/i }).first();
    await closeBtn.click();
    await expect(worksheetTitle).not.toBeVisible();

    // 9. Locate "Assign Practice Set"
    const assignBtn = page.getByRole('button', { name: /Assign Practice Set/i }).first();
    await expect(assignBtn).toBeVisible({ timeout: 5000 });

    // 10. Click it
    await assignBtn.click();

    // 11. Verify the action changes to "Practice Assigned"
    // Wait for the button text to transition
    const assignedMode = page.getByText(/Practice Assigned/i).first();
    await expect(assignedMode).toBeVisible({ timeout: 5000 });

    // 12. Verify the success feedback
    const toastMessage = page.getByText(/Practice exercises assigned to/i).first();
    await expect(toastMessage).toBeVisible();
  });
});
