import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../server.js';
import { closeDbPool } from '../src/serverDb.js';
import { after } from 'node:test';


process.env.JWT_SECRET = 'test_secret';

const adminToken = jwt.sign(
  { id: 'usr_1', email: 'admin@example.com', name: 'Admin', role: 'admin' },
  'test_secret',
  { expiresIn: '1h' }
);

const studentToken = jwt.sign(
  { id: 'usr_student', email: 'student@example.com', name: 'Student', role: 'student', institutionId: 'inst_1' },
  'test_secret',
  { expiresIn: '1h' }
);

test('Validation Middleware', async (t) => {
  await t.test('ai/adaptive-lesson rejects missing concept', async () => {
    const res = await request(app)
      .post('/api/ai/adaptive-lesson')
      .set('Cookie', [`access_token=${studentToken}`])
      .send({
        subject: 'Math'
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Invalid request data');
    assert.ok(res.body.details.some((d: any) => d.path === 'body.concept'));
  });

  await t.test('ai/adaptive-lesson rejects string too long concept', async () => {
    const res = await request(app)
      .post('/api/ai/adaptive-lesson')
      .set('Cookie', [`access_token=${studentToken}`])
      .send({
        concept: 'a'.repeat(200),
        subject: 'Math'
      });

    assert.strictEqual(res.status, 400);
  });

  await t.test('ai/adaptive-lesson accepts valid request', async () => {
    const res = await request(app)
      .post('/api/ai/adaptive-lesson')
      .set('Cookie', [`access_token=${studentToken}`])
      .send({
        concept: 'Addition',
        subject: 'Math'
      });

    // We expect 200, 401, 500, or something else since it's valid validation
    // Let's just assert it's not 400
    assert.notStrictEqual(res.status, 400, 'Should not fail Zod validation');
  });

  await t.test('admin/users limits page query param to int', async () => {
    const res = await request(app)
      .get('/api/admin/users?page=invalid')
      .set('Cookie', [`access_token=${adminToken}`]);

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.details.some((d: any) => d.path === 'query.page'));
  });

  await t.test('admin/users limits limit query param to max 100', async () => {
    const res = await request(app)
      .get('/api/admin/users?limit=200')
      .set('Cookie', [`access_token=${adminToken}`]);

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.details.some((d: any) => d.path === 'query.limit'));
  });

  await t.test('login schema enforces valid email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'not-an-email',
        password: 'password123'
      });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.details.some((d: any) => d.path === 'body.email'));
  });

  await t.test('login schema accepts valid email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    assert.notStrictEqual(res.status, 400, 'Should not fail Zod validation');
  });

  await t.test('register schema enforces password length', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test',
        email: 'test@example.com',
        password: '123' // Too short
      });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.details.some((d: any) => d.path === 'body.password'));
  });

  // Close db connections after testing
  
});
after(async () => { await closeDbPool(); });


