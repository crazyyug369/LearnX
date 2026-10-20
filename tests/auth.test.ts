import { test, mock, describe, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { claimPasswordSchema, institutionLoginSchema, loginSchema, registerSchema } from '../src/middleware/schemas.js';

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

describe('Authentication API', () => {

    after(() => {
        mock.reset();
    });
    
    test('1. Registration succeeds and sets cookie', async () => {
        mockQuery.mock.mockImplementation(async (sql, params) => {
            return [[]]; 
        });

        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });
        
        assert.strictEqual(res.status, 200, res.body.error);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.user);
        assert.strictEqual(res.body.user.email, 'test@example.com');

        const cookies = res.headers['set-cookie'];
        assert.ok(cookies, 'Cookie should be set');
        assert.ok(cookies[0].includes('access_token='), 'Cookie should contain access_token');
    });

    test('2. Registration fails on missing fields', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Test User' }); 
            
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.error, 'Name, email, and password required');
    });

    test('3. Login succeeds with correct credentials', async () => {
        mockQuery.mock.mockImplementation(async (sql, params) => {
            if (sql.includes('SELECT id, name, email, role, password_hash, needs_password, institution_id')) {
                return [[{
                    id: 'usr_1',
                    name: 'Test User',
                    email: 'test@example.com',
                    role: 'student',
                    password_hash: 'hashed_password123',
                    needs_password: 0
                }]];
            }
            return [[]];
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password123' });

        assert.strictEqual(res.status, 200, res.body.error);
        assert.strictEqual(res.body.success, true);
        
        const cookies = res.headers['set-cookie'];
        assert.ok(cookies, 'Cookie should be set');
        assert.ok(cookies[0].includes('access_token='), 'Cookie should contain access_token');
    });

    test('4. Login fails with invalid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'wrongpassword' });

        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.success, false);
    });

    test('5. Login asks to claim account if needs_password=true', async () => {
        mockQuery.mock.mockImplementation(async (sql, params) => {
            if (sql.includes('SELECT id, name, email, role, password_hash, needs_password, institution_id')) {
                return [[{
                    id: 'usr_1',
                    name: 'Old User',
                    email: 'old@example.com',
                    role: 'student',
                    password_hash: null,
                    needs_password: 1
                }]];
            }
            return [[]];
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'old@example.com', password: 'any12345' });

        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.needsClaim, true);
        assert.strictEqual(res.body.error, 'Account setup required');
        assert.ok(!('userId' in res.body), 'Login setup response must not expose userId');
    });

    test('6. Session Validation (/api/auth/me) fails without token', async () => {
        const res = await request(app).get('/api/auth/me');
        assert.strictEqual(res.status, 401);
    });

    test('7. Session Validation (/api/auth/me) succeeds with valid token', async () => {
        const token = jwt.sign(
            { id: 'usr_1', email: 'test@example.com', name: 'Test User', role: 'student' },
            'test_secret',
            { expiresIn: '1h' }
        );

        const res = await request(app)
            .get('/api/auth/me')
            .set('Cookie', [`access_token=${token}`]);
        
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.user.email, 'test@example.com');
    });

    test('8. Logout clears cookie', async () => {
        const res = await request(app).post('/api/auth/logout');
        
        assert.strictEqual(res.status, 200);
        const cookies = res.headers['set-cookie'];
        assert.ok(cookies);
        assert.ok(cookies[0].includes('access_token=;'));
        assert.ok(cookies[0].includes('Expires='), 'Cookie should have expiry set to past');
    });

    test('9. claim-password is disabled without explicit local development opt-in', async () => {
        mockQuery.mock.mockImplementation(async (sql, params) => {
            if (sql.includes('SELECT id, needs_password FROM users')) {
                return [[{ id: 'usr_1', needs_password: 1 }]];
            }
            if (sql.includes('UPDATE users SET password_hash')) {
                return [[]];
            }
            return [[]]; // generic return
        });

        const res = await request(app)
            .post('/api/auth/claim-password')
            .send({ email: 'old@example.com', newPassword: 'newsecure' });
        
        assert.strictEqual(res.status, 410);
        assert.strictEqual(res.body.success, false);
    });

    test('10. forgot-password reports that delivery is unavailable', async () => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: 'anyone@example.com' });
        
        assert.strictEqual(res.status, 503);
        assert.strictEqual(res.body.success, false);
        assert.ok(res.body.error.includes('delivery is not configured'));
    });

    test('11. Public registration always creates a student for privileged role=admin', async () => {
        let insertParams: any[] | undefined;
        mockQuery.mock.mockImplementation(async (sql, params) => {
            if (sql.includes('INSERT INTO users')) insertParams = params;
            return [[]];
        });

        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Admin Attempt', email: 'admin-attempt@example.com', password: 'password123', role: 'admin' });

        assert.strictEqual(res.status, 200, res.body.error);
        assert.strictEqual(res.body.user.role, 'student');
        assert.strictEqual(insertParams?.[5], 'student');
    });

    test('12. Public registration always creates a student for privileged role=institution', async () => {
        let insertParams: any[] | undefined;
        mockQuery.mock.mockImplementation(async (sql, params) => {
            if (sql.includes('INSERT INTO users')) insertParams = params;
            return [[]];
        });

        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Institution Attempt', email: 'institution-attempt@example.com', password: 'password123', role: 'institution' });

        assert.strictEqual(res.status, 200, res.body.error);
        assert.strictEqual(res.body.user.role, 'student');
        assert.strictEqual(insertParams?.[5], 'student');
    });

    test('13. Institution setup-required login response is generic and does not expose instId', async () => {
        mockQuery.mock.mockImplementation(async (sql) => {
            if (sql.includes('FROM institutions')) {
                return [[{
                    id: 'inst_setup',
                    name: 'Setup Institution',
                    email: 'setup@example.com',
                    code: 'SETUP2026',
                    password_hash: null,
                    needs_password: 1,
                    status: 'active',
                }]];
            }
            return [[]];
        });

        const res = await request(app)
            .post('/api/auth/institution-login')
            .send({ code: 'SETUP2026', password: 'password123' });

        assert.strictEqual(res.status, 403, res.body.error);
        assert.strictEqual(res.body.error, 'Account setup required');
        assert.strictEqual(res.body.needsClaim, true);
        assert.ok(!('instId' in res.body), 'Institution setup response must not expose instId');
        assert.ok(!('userId' in res.body), 'Institution setup response must not expose userId');
    });

    test('14. Institution login returns an allowlisted institution DTO', async () => {
        mockQuery.mock.mockImplementation(async (sql) => {
            if (sql.includes('FROM institutions')) {
                return [[{
                    id: 'inst_safe',
                    name: 'Safe Institution',
                    email: 'safe@example.com',
                    code: 'SAFE2026',
                    password_hash: 'hashed_password123',
                    password: 'legacy-secret',
                    needs_password: 0,
                    status: 'active',
                    internal_credential: 'do-not-return',
                }]];
            }
            return [[]];
        });

        const res = await request(app)
            .post('/api/auth/institution-login')
            .send({ code: 'SAFE2026', password: 'password123' });

        assert.strictEqual(res.status, 200, res.body.error);
        assert.deepStrictEqual(res.body.institution, {
            id: 'inst_safe',
            code: 'SAFE2026',
            name: 'Safe Institution',
            email: 'safe@example.com',
            status: 'active',
        });
        assert.ok(!('password_hash' in res.body.institution));
        assert.ok(!('password' in res.body.institution));
        assert.ok(!('needs_password' in res.body.institution));
        assert.ok(!('internal_credential' in res.body.institution));
    });

    test('15. Legacy auth flag is ignored in production', async () => {
        const previousNodeEnv = process.env.NODE_ENV;
        const previousLegacyFlag = process.env.ENABLE_LEGACY_AUTH;
        process.env.NODE_ENV = 'production';
        process.env.ENABLE_LEGACY_AUTH = 'true';

        try {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ name: 'Legacy User' });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.error, 'Email and password required');
        } finally {
            process.env.NODE_ENV = previousNodeEnv;
            process.env.ENABLE_LEGACY_AUTH = previousLegacyFlag;
        }
    });

    test('16. Password claiming is disabled in production', async () => {
        const previousNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        try {
            const res = await request(app)
                .post('/api/auth/claim-password')
                .send({ email: 'setup@example.com', newPassword: 'password123' });

            assert.strictEqual(res.status, 410);
            assert.strictEqual(res.body.success, false);
            assert.match(res.body.error, /disabled in production/i);
        } finally {
            process.env.NODE_ENV = previousNodeEnv;
        }
    });

    test('17. verifyToken rejects invalid role claims and missing secrets', async () => {
        const invalidRoleToken = jwt.sign(
            { id: 'usr_invalid_role', email: 'invalid@example.com', name: 'Invalid Role', role: 'superadmin' },
            'test_secret',
            { expiresIn: '1h' },
        );
        const invalidRoleResponse = await request(app)
            .get('/api/auth/me')
            .set('Cookie', [`access_token=${invalidRoleToken}`]);
        assert.strictEqual(invalidRoleResponse.status, 401);

        const previousSecret = process.env.JWT_SECRET;
        delete process.env.JWT_SECRET;
        try {
            const validToken = jwt.sign(
                { id: 'usr_secret', email: 'secret@example.com', name: 'Secret Test', role: 'student' },
                'test_secret',
                { expiresIn: '1h' },
            );
            const missingSecretResponse = await request(app)
                .get('/api/auth/me')
                .set('Cookie', [`access_token=${validToken}`]);
            assert.strictEqual(missingSecretResponse.status, 500);
            assert.strictEqual(missingSecretResponse.body.error, 'Server configuration error');
        } finally {
            process.env.JWT_SECRET = previousSecret;
        }
    });

    test('18. Auth schemas strip unknown fields and constrain roles', () => {
        const authSchemaCases = [
            [loginSchema, { email: 'user@example.com', password: 'password123', extra: 'ignored' }],
            [registerSchema, { name: 'User', email: 'user@example.com', password: 'password123', extra: 'ignored' }],
            [institutionLoginSchema, { code: 'SAFE2026', password: 'password123', extra: 'ignored' }],
            [claimPasswordSchema, { email: 'user@example.com', newPassword: 'password123', extra: 'ignored' }],
        ] as const;

        for (const [schema, body] of authSchemaCases) {
            const parsed = (schema as any).parse({ body });
            assert.ok(!('extra' in parsed.body));
        }

        assert.throws(() => registerSchema.parse({
            body: { name: 'User', email: 'user@example.com', password: 'password123', role: 'superadmin' },
        }));
        assert.throws(() => loginSchema.parse({
            body: { email: 'user@example.com', password: 'password123', role: 'superadmin' },
        }));
    });

    test('19. Production auth cookies are Secure and HttpOnly', async () => {
        const previousNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        mockQuery.mock.mockImplementation(async () => [[]]);

        try {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ name: 'Cookie User', email: 'cookie@example.com', password: 'password123' });

            assert.strictEqual(res.status, 200, res.body.error);
            const cookie = res.headers['set-cookie']?.[0] || '';
            assert.match(cookie, /Secure/);
            assert.match(cookie, /HttpOnly/);
            assert.match(cookie, /SameSite=Strict/);
        } finally {
            process.env.NODE_ENV = previousNodeEnv;
        }
    });
});
