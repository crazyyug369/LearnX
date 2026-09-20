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
process.env.ENABLE_LEGACY_AUTH = 'false';

import { app } from '../server.ts';

describe('Teacher & Student Authorization (Phase 2B)', () => {

    after(() => {
        mock.reset();
    });

    const createToken = (id: string, role: string, institutionId?: string) => {
        return jwt.sign(
            { id, email: 'test@example.com', name: 'Test User', role, institutionId },
            'test_secret',
            { expiresIn: '1h' }
        );
    };

    mockQuery.mock.mockImplementation(async (sql, params) => {
        if (sql.includes('SELECT institution_id FROM users WHERE id = ?')) {
            const userId = params[0];
            if (userId === 'usr_mapped') {
                return [[{ institution_id: 'inst_1' }]];
            }
            if (userId === 'usr_unmapped') {
                return [[{ institution_id: 'inst_2' }]];
            }
            return [[]]; // not found
        }

        // Generic successful returns for other queries
        if (sql.includes('SELECT') || sql.includes('UPDATE') || sql.includes('INSERT')) {
            return [[{ success_mock: true }]];
        }
        return [[]];
    });

    test('1. Student own-data access succeeds (200)', async () => {
        const token = createToken('usr_1', 'student');
        const res = await request(app)
            .get('/api/users/usr_1/progress')
            .set('Cookie', [`access_token=${token}`]);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
    });

    test('2. Student cross-student access is denied (403)', async () => {
        const token = createToken('usr_1', 'student');
        const res = await request(app)
            .get('/api/student/quiz-attempts/usr_2')
            .set('Cookie', [`access_token=${token}`]);
        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.error, 'Cannot access other student data');
    });

    test('3. Teacher cross-institution access is denied (403)', async () => {
        const token = createToken('teacher_1', 'teacher', 'inst_1');
        const res = await request(app)
            .get('/api/student/quiz-attempts/usr_unmapped')
            .set('Cookie', [`access_token=${token}`]);
        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.error, 'Student not in your institution');
    });

    test('4. Teacher own-cohort access succeeds (200)', async () => {
        const token = createToken('teacher_1', 'teacher', 'inst_1');
        const res = await request(app)
            .get('/api/student/quiz-attempts/usr_mapped')
            .set('Cookie', [`access_token=${token}`]);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
    });

    test('5. Admin full access succeeds, ignoring mappings (200)', async () => {
        const token = createToken('admin_1', 'admin');
        const res = await request(app)
            .get('/api/users/usr_unmapped/progress')
            .set('Cookie', [`access_token=${token}`]);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
    });

    test('6. Institution own-institution access succeeds (200)', async () => {
        const token = createToken('inst_1_admin', 'institution', 'inst_1');
        const res = await request(app)
            .get('/api/users/usr_mapped/progress')
            .set('Cookie', [`access_token=${token}`]);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
    });

    test('7. Teacher sending deployment request respects overrides', async () => {
        const token = createToken('teacher_1', 'teacher', 'inst_1');
        // This endpoint expects body param { studentIds, ... }, and in the implementation req.body.teacherId = req.user.id
        const res = await request(app)
            .post('/api/teacher/interventions/deploy')
            .set('Cookie', [`access_token=${token}`])
            .send({ studentIds: ['usr_mapped'], type: 'reteach', conceptTitle: 'Functions' });

        assert.strictEqual(res.status, 200, res.body?.error || 'Should deploy intervention');
        assert.strictEqual(res.body.success, true);
    });
});
