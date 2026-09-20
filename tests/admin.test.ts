import { test, mock, describe, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

const mockQuery = mock.fn<any>();
mock.method(mysql, 'createPool', () => ({
    query: mockQuery,
    end: mock.fn(),
    getConnection: mock.fn(),
    on: mock.fn(),
}));

process.env.JWT_SECRET = 'test_secret';

import { app } from '../server.ts';

describe('Admin Authorization (Phase 2A)', () => {

    after(() => {
        mock.reset();
    });
    
    mockQuery.mock.mockImplementation(async (sql, params) => {
        return [[]]; // generic return
    });

    const createToken = (role) => {
        return jwt.sign(
            { id: 'usr_mock', email: 'test@example.com', name: 'Test User', role },
            'test_secret',
            { expiresIn: '1h' }
        );
    };

    test('1. Unauthenticated access is rejected (401)', async () => {
        const res = await request(app).get('/api/admin/stats');
        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.success, false);
    });

    test('2. Student session is rejected (403)', async () => {
        const token = createToken('student');
        const res = await request(app)
            .get('/api/admin/stats')
            .set('Cookie', [`access_token=${token}`]);
        assert.strictEqual(res.status, 403);
    });

    test('3. Teacher session is rejected (403)', async () => {
        const token = createToken('teacher');
        const res = await request(app)
            .get('/api/admin/stats')
            .set('Cookie', [`access_token=${token}`]);
        assert.strictEqual(res.status, 403);
    });

    test('4. Institution session is rejected (403)', async () => {
        const token = createToken('institution');
        const res = await request(app)
            .get('/api/admin/stats')
            .set('Cookie', [`access_token=${token}`]);
        assert.strictEqual(res.status, 403);
    });

    test('5. Authenticated admin access succeeds (200)', async () => {
        const token = createToken('admin');
        const res = await request(app)
            .get('/api/admin/stats')
            .set('Cookie', [`access_token=${token}`]);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.kpi);
    });
});

