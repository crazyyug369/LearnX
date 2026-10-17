import { test, mock, describe, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const mockQuery = mock.fn<any>();
mock.method(mysql, 'createPool', () => ({
  query: mockQuery,
  end: mock.fn(),
  getConnection: mock.fn(),
  on: mock.fn(),
}));

mock.method(bcrypt, 'hash', async (pass) => 'hashed_' + pass);
mock.method(bcrypt, 'compare', async (pass, hash) => hash === 'hashed_' + pass);

process.env.JWT_SECRET = 'test_secret';
process.env.ENABLE_LEGACY_AUTH = 'false';
process.env.NODE_ENV = 'test';

import { app } from '../server.ts';

describe('Routing and Auth API Tests', () => {
  after(() => {
    mock.reset();
  });

  test('unknown browser GET path returns HTTP 404', async () => {
    const res = await request(app).get('/unknown-path');
    assert.strictEqual(res.status, 404);
    assert.ok(res.text.includes('Not Found') || res.text.includes('Cannot GET'));
  });

  test('unknown API path returns JSON 404', async () => {
    const res = await request(app)
      .get('/api/unknown-endpoint')
      .expect('Content-Type', /json/);

    assert.strictEqual(res.status, 404);
    assert.deepStrictEqual(res.body, {
      success: false,
      error: 'API route not found',
    });
  });

  test('/api/auth/session with no cookie returns user: null', async () => {
    const res = await request(app)
      .get('/api/auth/session')
      .expect('Content-Type', /json/);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user, null);
  });

  test('/api/auth/session with valid cookie returns user data', async () => {
    const token = jwt.sign(
      {
        id: 'usr_test',
        email: 'test@example.com',
        name: 'Test User',
        role: 'student',
        institutionId: 'inst_test',
      },
      'test_secret',
      { expiresIn: '1h' },
    );

    const res = await request(app)
      .get('/api/auth/session')
      .set('Cookie', [`access_token=${token}`])
      .expect('Content-Type', /json/);

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.user, {
      id: 'usr_test',
      email: 'test@example.com',
      name: 'Test User',
      role: 'student',
      institutionId: 'inst_test',
    });
  });

  test('/api/auth/session with invalid cookie returns user: null', async () => {
    const invalidToken = jwt.sign({ id: 'usr_test' }, 'wrong_secret', { expiresIn: '1h' });
    const res = await request(app)
      .get('/api/auth/session')
      .set('Cookie', [`access_token=${invalidToken}`])
      .expect('Content-Type', /json/);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user, null);
  });

  test('/api/auth/me returns 401 with no cookie', async () => {
    const res = await request(app).get('/api/auth/me').expect('Content-Type', /json/);
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  test('/api/auth/me returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', ['access_token=invalid.token.here'])
      .expect('Content-Type', /json/);

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  test('/api/auth/me works with valid token', async () => {
    const token = jwt.sign(
      { id: 'usr_me_test', email: 'me@example.com', name: 'ME Test User', role: 'admin' },
      'test_secret',
      { expiresIn: '1h' },
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`access_token=${token}`])
      .expect('Content-Type', /json/);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.id, 'usr_me_test');
    assert.strictEqual(res.body.user.role, 'admin');
  });
});
