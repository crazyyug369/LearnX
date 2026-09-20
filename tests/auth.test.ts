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

    test('9. claim-password sets new password for needs_password=true', async () => {
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
        
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
    });

    test('10. forgot-password returns generic success', async () => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: 'anyone@example.com' });
        
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.message.includes('a reset link will be sent'));
    });
});
