import * as dotenv from 'dotenv';
dotenv.config();
async function run() {
  const { getDbPool } = await import('./src/serverDb.ts');
  try {
    const db = getDbPool();
    const [q] = await db.query('SELECT COUNT(*) as cnt FROM quiz_attempts');
    const [c] = await db.query('SELECT COUNT(*) as cnt FROM cohort_students');
    const [p] = await db.query('SELECT COUNT(*) as cnt FROM student_progress');
    const [u] = await db.query('SELECT COUNT(*) as cnt FROM users');
    console.log('Quiz attempts:', q[0].cnt);
    console.log('Cohort students:', c[0].cnt);
    console.log('Progress records:', p[0].cnt);
    console.log('Total users:', u[0].cnt);
    process.exit(0);
  } catch(e) {}
}
run();
