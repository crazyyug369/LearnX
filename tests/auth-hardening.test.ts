import { after, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const savedEnv = { ...process.env };
const queries: { sql: string; params: any[] }[] = [];
let queryResult: (sql: string, params: any[]) => Promise<any> = async () => [[]];
const query = async (sql: string, params: any[] = []) => {
  queries.push({ sql, params });
  return queryResult(sql, params);
};
mock.method(mysql, 'createPool', () => ({ query, end: async () => {} }));
// An accidental initialization must fail in-process, never reach a local DB.
mock.method(mysql, 'createConnection', async () => { throw new Error('Live DB initialization prohibited in tests'); });
const hashMock = mock.method(bcrypt, 'hash', async (password: string) => `fixture-hash:${password}`);
const compareMock = mock.method(bcrypt, 'compare', async (password: string, hash: string) => hash === `fixture-hash:${password}`);

const { authRouter, verifyToken, requireRole } = await import('../src/auth.js');
const { closeDbPool } = await import('../src/serverDb.js');
const app = express();
app.use(express.json(), cookieParser());
app.use('/auth', authRouter);
app.get('/admin-only', verifyToken, requireRole(['admin']), (_req, res) => res.json({ success: true }));

const secret = 'security-regression-fixture-secret';
const claims = { id: 'fixture-user', name: 'Fixture User', email: 'fixture@example.test', role: 'student' };
const token = (overrides = {}, options: jwt.SignOptions = { expiresIn: '1h' }) => jwt.sign({ ...claims, ...overrides }, secret, options);
const currentAccount = (overrides = {}) => ({
  ...claims, password_hash: 'fixture-hash:password123', needs_password: 0, institutionId: null, ...overrides,
});
const authenticated = (path: string, signedToken = token()) => request(app).get(path).set('Cookie', `access_token=${signedToken}`);

describe('Authentication hardening', () => {
  beforeEach(async () => {
    await closeDbPool();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = secret;
    process.env.ENABLE_LEGACY_AUTH = 'false';
    delete process.env.REVALIDATE_AUTH_ACCOUNTS;
    queries.length = 0;
    queryResult = async () => [[]];
    hashMock.mock.resetCalls();
    compareMock.mock.resetCalls();
  });

  after(async () => {
    await closeDbPool();
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
    mock.restoreAll();
  });

  test('requires exp and a supported bounded JWT, for both /me and /session', async () => {
    for (const signedToken of [
      token({}, {}),
      token({}, { expiresIn: '1h', algorithm: 'HS384' }),
      token({}, { expiresIn: '8h' }),
      token({ role: 'superadmin' }),
      token({ iat: Math.floor(Date.now() / 1000) + 600 }),
    ]) {
      assert.equal((await authenticated('/auth/me', signedToken)).status, 401);
      const session = await authenticated('/auth/session', signedToken);
      assert.equal(session.status, 200);
      assert.equal(session.body.user, null);
    }
    assert.equal(queries.length, 0);
  });

  test('test/development token verification is isolated from MySQL by default', async () => {
    queryResult = async () => { throw new Error('Authorization must not contact DB here'); };
    const response = await authenticated('/auth/me');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.user, claims);
    assert.equal(queries.length, 0);
  });

  test('production rejects deleted, demoted, moved, setup-revoked and suspended-tenant accounts immediately', async () => {
    process.env.NODE_ENV = 'production';
    const teacherClaims = { role: 'teacher', institutionId: 'fixture-tenant' };
    for (const account of [
      null,
      currentAccount({ ...teacherClaims, role: 'student', institutionStatus: 'active' }),
      currentAccount({ ...teacherClaims, institutionId: 'different-tenant', institutionStatus: 'active' }),
      currentAccount({ ...teacherClaims, needs_password: 1, institutionStatus: 'active' }),
      currentAccount({ ...teacherClaims, institutionStatus: 'suspended' }),
    ]) {
      queryResult = async () => [account ? [account] : []];
      assert.equal((await authenticated('/auth/me', token(teacherClaims))).status, 401);
      assert.equal((await authenticated('/auth/session', token(teacherClaims))).body.user, null);
    }
  });

  test('a valid production account is reloaded on each request and does not leak credentials', async () => {
    process.env.NODE_ENV = 'production';
    let role = 'admin';
    queryResult = async () => [[currentAccount({ role })]];
    const signedToken = token({ role: 'admin' });
    assert.equal((await authenticated('/admin-only', signedToken)).status, 200);
    role = 'student';
    assert.equal((await authenticated('/admin-only', signedToken)).status, 401);
    assert.equal(queries.length, 2);
    const response = await authenticated('/auth/me', token());
    assert.deepEqual(response.body.user, claims);
    assert.ok(!JSON.stringify(response.body).includes('password_hash'));
  });

  test('production institution sessions reject suspended or pending accounts', async () => {
    process.env.NODE_ENV = 'production';
    const institutionClaims = { id: 'fixture-tenant', institutionId: 'fixture-tenant', role: 'institution' };
    for (const status of ['suspended', 'pending']) {
      queryResult = async () => [[{ ...currentAccount(), id: 'fixture-tenant', status }]];
      assert.equal((await authenticated('/auth/me', token(institutionClaims))).status, 401);
    }
  });

  test('production database outages are 503, not an anonymous session or invalid credentials', async () => {
    process.env.NODE_ENV = 'production';
    queryResult = async () => { throw Object.assign(new Error('fixture driver failure'), { code: 'ECONNREFUSED' }); };
    for (const path of ['/auth/me', '/auth/session']) {
      const response = await authenticated(path);
      assert.equal(response.status, 503);
      assert.equal(response.body.success, false);
      assert.match(response.body.error, /temporarily unavailable/i);
    }
    const login = await request(app).post('/auth/login').send({ email: claims.email, password: 'password123' });
    assert.equal(login.status, 503);
  });

  test('invalid production tokens do not contact the database', async () => {
    process.env.NODE_ENV = 'production';
    const response = await authenticated('/auth/me', 'not-a-token');
    assert.equal(response.status, 401);
    assert.equal(queries.length, 0);
  });

  test('login is exact email-only and rejects an ambiguous case-insensitive email result', async () => {
    queryResult = async () => [[currentAccount(), currentAccount({ id: 'duplicate-user' })]];
    const response = await request(app).post('/auth/login').send({ email: claims.email, password: 'password123' });
    assert.equal(response.status, 401);
    assert.equal(compareMock.mock.calls.length, 0);
    assert.ok(!queries[0].sql.includes('LOWER(name)'));
    assert.match(queries[0].sql, /LIMIT 2/);
    assert.deepEqual(queries[0].params, [claims.email]);
  });

  test('institution login selects one identifier and rejects duplicate institution emails', async () => {
    const institution = { id: 'fixture-tenant', code: 'FIXTURE', name: 'Fixture', email: claims.email, status: 'active', needs_password: 0, password_hash: 'fixture-hash:password123' };
    queryResult = async () => [[institution, { ...institution, id: 'different-tenant' }]];
    const response = await request(app).post('/auth/institution-login').send({ email: claims.email, password: 'password123' });
    assert.equal(response.status, 401);
    assert.ok(!queries[0].sql.includes(' OR '));
    assert.equal(compareMock.mock.calls.length, 0);
  });

  test('rejects passwords beyond bcrypt UTF-8 byte limit before compare/hash/DB', async () => {
    const overLimit = 'é'.repeat(37);
    for (const [path, body] of [
      ['/auth/register', { name: claims.name, email: claims.email, password: overLimit }],
      ['/auth/login', { email: claims.email, password: overLimit }],
      ['/auth/institution-login', { code: 'FIXTURE', password: overLimit }],
    ] as const) {
      const response = await request(app).post(path).send(body);
      assert.equal(response.status, 400);
      assert.match(response.body.error, /72 UTF-8 bytes/);
    }
    assert.equal(queries.length, 0);
    assert.equal(hashMock.mock.calls.length, 0);
    assert.equal(compareMock.mock.calls.length, 0);
  });

  test('accepts exactly 72 password bytes and retains secure cookie/role restrictions', async () => {
    process.env.NODE_ENV = 'production';
    queryResult = async () => [{ affectedRows: 1 }];
    const response = await request(app).post('/auth/register').send({ name: claims.name, email: 'Fixture@Example.test', password: 'é'.repeat(36), role: 'admin' });
    assert.equal(response.status, 200);
    assert.equal(response.body.user.role, 'student');
    assert.equal(response.body.user.email, 'fixture@example.test');
    assert.match(response.headers['set-cookie'][0], /HttpOnly/);
    assert.match(response.headers['set-cookie'][0], /Secure/);
    assert.match(response.headers['set-cookie'][0], /SameSite=Strict/);
    assert.equal(hashMock.mock.calls[0].arguments[1], 12);
  });

  test('password claim is disabled unless explicitly enabled for local development', async () => {
    for (const environment of ['production', 'test', 'development', 'staging']) {
      process.env.NODE_ENV = environment;
      process.env.ENABLE_LEGACY_AUTH = environment === 'development' ? 'false' : 'true';
      const response = await request(app).post('/auth/claim-password').send({ email: claims.email, newPassword: 'password123' });
      assert.equal(response.status, 410);
    }
    assert.equal(queries.length, 0);
  });

  test('local opt-in claim clears legacy plaintext and uses a race-safe needs_password predicate', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_LEGACY_AUTH = 'true';
    queryResult = async (sql) => sql.startsWith('SELECT') ? [[{ id: claims.id, needs_password: 1 }]] : [{ affectedRows: 1 }];
    const response = await request(app).post('/auth/claim-password').send({ email: claims.email, newPassword: 'password123' });
    assert.equal(response.status, 200);
    assert.match(queries[1].sql, /password = NULL/);
    assert.match(queries[1].sql, /AND needs_password = TRUE/);
    assert.equal(hashMock.mock.calls[0].arguments[1], 12);
  });

  test('forgot-password gives identical truthful unavailable responses and performs no account lookup', async () => {
    const existing = await request(app).post('/auth/forgot-password').send({ email: claims.email });
    const absent = await request(app).post('/auth/forgot-password').send({ email: 'absent@example.test' });
    assert.equal(existing.status, 503);
    assert.deepEqual(existing.body, absent.body);
    assert.equal(existing.body.success, false);
    assert.match(existing.body.error, /not configured/i);
    assert.equal(queries.length, 0);
  });
});
