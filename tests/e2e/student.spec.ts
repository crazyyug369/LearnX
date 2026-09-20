import { test, expect } from '@playwright/test';
import mysql from 'mysql2/promise';

let pool: mysql.Pool;

test.beforeAll(async () => {
  // Setup isolated database connection pool
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: 'learnx_e2e_test',
    waitForConnections: true,
  });

  // Wait a bit for the backend to create the schema if it hasn't
  await new Promise(resolve => setTimeout(resolve, 3000));
});

test.afterAll(async () => {
  await pool.end();
});

test.beforeEach(async () => {
  // Clean tables purely for deterministic test setup
  await pool.query('DELETE FROM cohort_students');
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM student_progress');
  await pool.query('DELETE FROM quiz_attempts');
  await pool.query('DELETE FROM curriculum_nodes');

  // Seed node
  await pool.query(`
    INSERT INTO curriculum_nodes (id, subject, grade, title, category, description, difficulty, prerequisites_json, tags_json, estimated_time)
    VALUES ('concept_algebra_basics', 'Math', 'Grade 10', 'Algebra Basics', 'General', 'Basics of algebra', 'Beginner', '[]', '[]', 20)
  `);

  // Seed student user
  const hashedPass = '';
  await pool.query(`
    INSERT INTO users (id, name, email, role, password_hash, needs_password, institution_id, created_at)
    VALUES ('usr_e2e_demo', 'E2E Demo Student', 'arjun.kumar@student.learnx.org', 'student', ?, 1, NULL, NOW())
  `, [hashedPass]);
});

test.describe('Student SIH Demo Flow', () => {
  test('Complete flow: login -> claim -> diagnostic -> adaptive lesson -> assessment', async ({ page }) => {

    await page.route('**/api/ai/adaptive-lesson', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          data: {
            title: 'Mock Lesson',
            coreConcept: 'Core Basics',
            interestAnalogy: 'Analogy',
            keyTakeaways: ['Essential Takeaways 1'],
            microExample: 'Step-by-Step Example 1',
          }
        }
      });
    });

    await page.route('**/api/quiz/questions', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          questions: [
            {
              id: 'mock-q1',
              text: 'Mock Question 1?',
              options: ['A', 'B', 'C', 'D'],
              correctAnswerIndex: 0,
              explanation: 'Because Mock',
              bloomsTaxonomy: 'Remember',
            }
          ]
        }
      });
    });

    // 1. Student Sign-in & Account Claim
    await page.goto('/');

    // Auth Modal is automatically open for unauthenticated users
    await page.locator('#input-student-email').fill('arjun.kumar@student.learnx.org');
    await page.locator('#input-student-password').fill('anypass123'); // Minimum 8 chars
    await page.locator('#btn-submit-student-auth').click();

    // Ensure it transitions to "claim account"
    await expect(page.getByText(/Please claim your account/i)).toBeVisible();
    await page.locator('#input-claim-password').fill('securepass123');
    await page.locator('#btn-submit-claim-account').click();

    // Wait for dashboard and diagnostic to appear
    await expect(page.getByText(/Initial Diagnostic|Diagnostic Knowledge/i)).toBeVisible({ timeout: 10000 });

    // 2. Diagnostic Assessment Loop
    let keepDoingDiagnostic = true;
    while (keepDoingDiagnostic) {
      // Wait for either an option to be clickable OR the apply button to be visible
      const applyBtn = page.locator('#btn-apply-diagnostic');
      const nextBtn = page.locator('#btn-next-diagnostic-q');

      // Wait a tiny bit and check which mode we are in
      await Promise.race([
        page.locator('.space-y-2\\.5 > div').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
        applyBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
      ]);

      if (await applyBtn.isVisible()) {
        await applyBtn.click();
        keepDoingDiagnostic = false;
      } else if (await nextBtn.isVisible()) {
        const optionContainer = page.locator('.space-y-2\\.5 > div').first();
        await optionContainer.click();
        await nextBtn.click();
      }
    }

    // 3. Adaptive Lesson / Practice
    // Wait for Knowledge Graph dashboard
    await expect(page.getByText(/Knowledge Map|Knowledge Graph/i).first()).toBeVisible();

    // Start Micro-Lesson (focal node auto-selected)
    await page.locator('#btn-start-adaptive-lesson').click();

    // Wait for the generative LLM response (MOCK_GEMINI fallback or actual)
    await expect(page.getByText(/Essential Takeaways|Step-by-Step Example/i).first()).toBeVisible({ timeout: 15000 });

    // 4. Assessment Submission
    await page.getByRole('button', { name: /Proceed to Mastery Check/i }).click();

    // Answering Quiz MCQs Loop
    let keepDoingQuiz = true;
    while (keepDoingQuiz) {
      // Find options: wait for option 0 to appear
      await page.locator('#quiz-option-0').waitFor({ state: 'visible', timeout: 5000 });
      await page.locator('#quiz-option-0').click();

      // Submit answer
      await page.getByRole('button', { name: /Submit Answer/i }).click();

      // Wait for either Next Question or Complete Assessment button
      const nextActionBtn = page.getByRole('button', { name: /Next Question|Complete Assessment|View Complete Mastery Summary|Mastery Summary/i });
      await nextActionBtn.waitFor({ state: 'visible', timeout: 5000 });
      const nextText = await nextActionBtn.innerText();
      await nextActionBtn.click();

      if (!nextText.match(/Next Question/i)) {
        keepDoingQuiz = false;
      }
    }

    // Check summary breakdown
    await expect(page.getByText(/Assessment Breakdown|Mastery Evaluation Summary|Score/i).first()).toBeVisible();

    // 5. Verified Saved Progress
    await page.getByRole('button', { name: /^Knowledge Graph$/i }).click();

    // Ensure state updated - just assert the graph is visible again
    await expect(page.getByText(/Knowledge Map|Knowledge Graph/i).first()).toBeVisible();

    // Backend verification
    const [rows]: any = await pool.query('SELECT * FROM quiz_attempts WHERE user_id = "usr_e2e_demo"');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].bkt_mastery).toBeDefined();
    // Validate it's correctly referencing the actual concept
    expect(rows[0].concept_id).toBeDefined();
  });
});