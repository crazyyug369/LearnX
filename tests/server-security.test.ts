import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';
process.env.ENABLE_LEGACY_AUTH = 'false';
process.env.MOCK_GEMINI = 'true';
process.env.FRONTEND_ORIGIN = 'https://frontend.example.test';

const mockQuery = mock.fn<any>();
mockQuery.mock.mockImplementation(async () => [[]]);
mock.method(mysql, 'createPool', () => ({
  query: mockQuery,
  end: mock.fn(),
  getConnection: mock.fn(),
  on: mock.fn(),
}));

const { app, createRateLimiter, createStaticAssetHandler, resolveStaticAssetPath } = await import('../server.ts');

after(() => {
  mock.reset();
});

test('static asset resolution denies traversal, server bundles, and source maps', async () => {
  const distRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'learnx-security-'));
  const assetsRoot = path.join(distRoot, 'assets');
  fs.mkdirSync(assetsRoot);
  fs.writeFileSync(path.join(distRoot, 'index.html'), '<html></html>');
   fs.writeFileSync(path.join(distRoot, 'server.cjs'), 'private');
    fs.writeFileSync(path.join(distRoot, 'server.cjs.map'), 'private');
    fs.writeFileSync(path.join(distRoot, 'early-seo.js'), 'public');
    fs.writeFileSync(path.join(distRoot, 'favicon.svg'), '<svg></svg>');
    fs.writeFileSync(path.join(assetsRoot, 'app.js'), 'public');
  fs.writeFileSync(path.join(assetsRoot, 'app.js.map'), 'private');

  try {
    assert.ok(resolveStaticAssetPath(distRoot, '/index.html'));
    assert.ok(resolveStaticAssetPath(distRoot, '/early-seo.js'));
    assert.ok(resolveStaticAssetPath(distRoot, '/favicon.svg'));
    assert.ok(resolveStaticAssetPath(distRoot, '/assets/app.js'));
    assert.equal(resolveStaticAssetPath(distRoot, '/../server.cjs'), null);
    assert.equal(resolveStaticAssetPath(distRoot, '/assets/%2e%2e/server.cjs'), null);
    assert.equal(resolveStaticAssetPath(distRoot, '/server.cjs'), null);
    assert.equal(resolveStaticAssetPath(distRoot, '/server.cjs.map'), null);
    assert.equal(resolveStaticAssetPath(distRoot, '/assets/app.js.map'), null);

    const staticApp = express();
    staticApp.get('*', createStaticAssetHandler(distRoot));
    const traversalResponse = await request(staticApp).get('/assets/%2e%2e/server.cjs');
    assert.equal(traversalResponse.status, 404);
  } finally {
    fs.rmSync(distRoot, { recursive: true, force: true });
  }
});

test('security headers and CORS allow only the configured frontend and same-origin requests', async () => {
  const allowed = await request(app)
    .get('/api/health')
    .set('Origin', 'https://frontend.example.test');

  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers['x-powered-by'], undefined);
  assert.equal(allowed.headers['x-content-type-options'], 'nosniff');
  assert.equal(allowed.headers['x-frame-options'], 'DENY');
  assert.equal(allowed.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.equal(allowed.headers['cache-control'], 'no-store');
  assert.equal(allowed.headers['x-dns-prefetch-control'], 'off');
  assert.equal(allowed.headers['x-permitted-cross-domain-policies'], 'none');
  assert.equal(allowed.headers['cross-origin-opener-policy'], 'same-origin');
  assert.equal(allowed.headers['access-control-allow-origin'], 'https://frontend.example.test');
  assert.equal(allowed.headers['access-control-allow-credentials'], 'true');

  const sameOrigin = await request(app)
    .get('/api/health')
    .set('Host', 'same-origin.example.test')
    .set('Origin', 'http://same-origin.example.test');
  assert.equal(sameOrigin.status, 200);
  assert.equal(sameOrigin.headers['access-control-allow-origin'], 'http://same-origin.example.test');

  const denied = await request(app)
    .get('/api/health')
    .set('Origin', 'https://evil.example.test');
  assert.equal(denied.status, 403);
  assert.equal(denied.headers['access-control-allow-origin'], undefined);

  const malformed = await request(app)
    .get('/api/health')
    .set('Origin', 'not-an-origin');
  assert.equal(malformed.status, 403);
});

test('rate limiter returns 429 with Retry-After', async () => {
  const limitedApp = express();
  const limiter = createRateLimiter({
    windowMs: 60_000,
    max: 1,
    keyGenerator: () => 'security-test-client',
  });
  limitedApp.get('/limited', limiter, (_req, res) => res.json({ success: true }));

  assert.equal((await request(limitedApp).get('/limited')).status, 200);
  const limited = await request(limitedApp).get('/limited');
  assert.equal(limited.status, 429);
  assert.match(String(limited.headers['retry-after']), /^\d+$/);
  assert.equal(limited.body.error, 'Too many requests. Please try again later.');
  limiter.reset();
});

test('JSON request bodies are bounded', async () => {
  const oversized = await request(app)
    .post('/api/diagnostic/calibrate')
    .set('Content-Type', 'application/json')
    .send({ payload: 'x'.repeat(110_000) });

  assert.equal(oversized.status, 413);
  assert.deepEqual(oversized.body, { success: false, error: 'Request body too large' });
});

test('production configuration rejects placeholder secrets and unsafe debug flags', async () => {
  const previousEnv = {
    nodeEnv: process.env.NODE_ENV,
    jwtSecret: process.env.JWT_SECRET,
    mysqlHost: process.env.MYSQL_HOST,
    mysqlUser: process.env.MYSQL_USER,
    mysqlPassword: process.env.MYSQL_PASSWORD,
    mysqlDatabase: process.env.MYSQL_DATABASE,
    legacy: process.env.ENABLE_LEGACY_AUTH,
    mockGemini: process.env.MOCK_GEMINI,
  };

  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'your_jwt_secret_here';
  process.env.MYSQL_HOST = 'localhost';
  process.env.MYSQL_USER = 'learnx_app';
  process.env.MYSQL_PASSWORD = 'strong-password';
  process.env.MYSQL_DATABASE = 'learnx_db';
  process.env.ENABLE_LEGACY_AUTH = 'false';
  process.env.MOCK_GEMINI = 'false';

  try {
    const module = await import('../server.ts');
    await assert.rejects(
      () => (module as any).startServer(),
      /JWT_SECRET must be configured/i,
    );
  } finally {
    process.env.NODE_ENV = previousEnv.nodeEnv;
    process.env.JWT_SECRET = previousEnv.jwtSecret;
    process.env.MYSQL_HOST = previousEnv.mysqlHost;
    process.env.MYSQL_USER = previousEnv.mysqlUser;
    process.env.MYSQL_PASSWORD = previousEnv.mysqlPassword;
    process.env.MYSQL_DATABASE = previousEnv.mysqlDatabase;
    process.env.ENABLE_LEGACY_AUTH = previousEnv.legacy;
    process.env.MOCK_GEMINI = previousEnv.mockGemini;
  }
});

test('high-risk routes require authentication and role gates', async () => {
  const diagnostic = await request(app)
    .post('/api/diagnostic/calibrate')
    .send({ userId: 'attacker', answers: [] });
  assert.equal(diagnostic.status, 401);

  const curriculumPost = await request(app)
    .post('/api/curriculum')
    .send({ title: 'Private', subject: 'Mathematics' });
  assert.equal(curriculumPost.status, 401);

  const curriculumDelete = await request(app).delete('/api/curriculum/private-node');
  assert.equal(curriculumDelete.status, 401);

  const aiSuggest = await request(app)
    .post('/api/curriculum/ai-suggest')
    .send({ title: 'Gravity' });
  assert.equal(aiSuggest.status, 401);

  const bktTrace = await request(app)
    .post('/api/models/bkt/trace')
    .send({ answers: [true] });
  assert.equal(bktTrace.status, 401);

  const datasetSearch = await request(app).get('/api/models/dataset/search?q=gravity');
  assert.equal(datasetSearch.status, 401);

  const studentToken = jwt.sign(
    { id: 'student-1', email: 'student@example.test', name: 'Student', role: 'student' },
    'test_secret',
    { expiresIn: '1h' },
  );
  const studentSuggest = await request(app)
    .post('/api/curriculum/ai-suggest')
    .set('Cookie', [`access_token=${studentToken}`])
    .send({ title: 'Gravity' });
  assert.equal(studentSuggest.status, 403);
});

test('diagnostic calibration uses the authenticated user id instead of the payload id', async () => {
  let selectedUserId: unknown;
  mockQuery.mock.mockImplementation(async (sql, params) => {
    if (String(sql).includes('SELECT concepts_json, overall_mastery')) selectedUserId = params[0];
    return [[]];
  });

  const token = jwt.sign(
    { id: 'authenticated-user', email: 'student@example.test', name: 'Student', role: 'student' },
    'test_secret',
    { expiresIn: '1h' },
  );
  const response = await request(app)
    .post('/api/diagnostic/calibrate')
    .set('Cookie', [`access_token=${token}`])
    .send({ userId: 'attacker-user', answers: [] });

  assert.equal(response.status, 200);
  assert.equal(selectedUserId, 'authenticated-user');
});
