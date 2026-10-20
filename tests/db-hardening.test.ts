import { after, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { buildDatabaseConfig } from '../src/security/dbConfig.js';
import { redactAuditDetails } from '../src/security/audit.js';
import { DatabaseUnavailableError, ResourceAccessError } from '../src/security/errors.js';
import type { SecurityPrincipal } from '../src/security/authorization.js';

const savedEnv = { ...process.env };
const queries: { sql: string; params: any[] }[] = [];
const poolConfigs: any[] = [];
const connectionConfigs: any[] = [];
let commits = 0;
let rollbacks = 0;
let releases = 0;
let queryResult: (sql: string, params: any[]) => Promise<any>;
const query = async (sql: string, params: any[] = []) => {
  queries.push({ sql, params });
  return queryResult(sql, params);
};
const connection = {
  query,
  beginTransaction: async () => {},
  commit: async () => { commits++; },
  rollback: async () => { rollbacks++; },
  release: () => { releases++; },
};
mock.method(mysql, 'createPool', (config) => {
  poolConfigs.push(config);
  return { query, end: async () => {}, getConnection: async () => connection };
});
// Mock BOTH connection entry points before any initialization test.
mock.method(mysql, 'createConnection', async (config) => {
  connectionConfigs.push(config);
  return { query: async () => [{ affectedRows: 0 }], end: async () => {} };
});
const hashMock = mock.method(bcrypt, 'hash', async (password: string) => `fixture-hash:${password}`);
mock.method(bcrypt, 'compare', async (password: string, hash: string) => hash === `fixture-hash:${password}`);
mock.method(console, 'error', () => {});

const db = await import('../src/serverDb.js');
const teacher: SecurityPrincipal = { id: 'fixture-teacher', role: 'teacher', institutionId: 'tenant-a' };
const admin: SecurityPrincipal = { id: 'fixture-admin', role: 'admin' };
const institution = { id: 'tenant-a', code: 'TENANTA', name: 'Tenant A', status: 'active' };
const existingStudent = { id: 'student-a', email: 'student@example.test', role: 'student', institution_id: 'tenant-a', student_id: 'STUDENT-A' };
const node = { id: 'fixture-node', title: 'Fixture Algebra', subject: 'Mathematics', createdBy: 'forged-owner' };
const writes = () => queries.filter(({ sql }) => /^\s*(INSERT|UPDATE|DELETE)/i.test(sql));
const enrollmentQueries = async (sql: string) => {
  if (sql.includes('FROM institutions')) return [[institution]];
  if (sql.startsWith('SELECT')) return [[]];
  return [{ affectedRows: 1 }];
};
const initializationQueries = async (sql: string) => {
  if (sql.includes('SELECT COUNT(*)')) return [[{ cnt: 1 }]];
  if (sql.includes("WHERE role = 'admin'")) return [[{ id: 'fixture-admin' }]];
  if (sql.trim().startsWith('SELECT')) return [[]];
  return [{ affectedRows: 1 }];
};

describe('Database security hardening (mocked MySQL only)', () => {
  beforeEach(async () => {
    await db.closeDbPool();
    process.env.NODE_ENV = 'test';
    process.env.MYSQL_HOST = 'fixture-db.invalid';
    process.env.MYSQL_DATABASE = 'fixture_db';
    process.env.MYSQL_PORT = '3306';
    process.env.ENABLE_LEGACY_AUTH = 'false';
    delete process.env.MYSQL_SSL;
    delete process.env.MYSQL_SSL_CA;
    delete process.env.MYSQL_SSL_CA_FILE;
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    queries.length = 0;
    poolConfigs.length = 0;
    connectionConfigs.length = 0;
    commits = rollbacks = releases = 0;
    queryResult = enrollmentQueries;
    hashMock.mock.resetCalls();
  });

  after(async () => {
    await db.closeDbPool();
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
    mock.restoreAll();
  });

  test('pool config is lazy and TLS verifies both certificate trust and server identity', () => {
    process.env.MYSQL_HOST = 'later-config.invalid';
    process.env.MYSQL_SSL = 'true';
    process.env.MYSQL_SSL_CA = 'fixture-ca-line-one\\nfixture-ca-line-two';
    db.getDbPool();
    assert.equal(poolConfigs[0].host, 'later-config.invalid');
    assert.deepEqual(poolConfigs[0].ssl, {
      rejectUnauthorized: true, verifyIdentity: true, minVersion: 'TLSv1.2', ca: 'fixture-ca-line-one\nfixture-ca-line-two',
    });
  });

  test('TLS config refuses downgrade/invalid settings and permits verified public roots', () => {
    assert.throws(() => buildDatabaseConfig({ MYSQL_SSL: 'false', MYSQL_SSL_CA: 'fixture-ca' }));
    assert.throws(() => buildDatabaseConfig({ MYSQL_SSL: 'insecure' }));
    assert.throws(() => buildDatabaseConfig({ MYSQL_PORT: 'not-a-port' }));
    assert.throws(() => buildDatabaseConfig({ MYSQL_SSL_CA_FILE: 'Z:\\nonexistent-fixture-ca.pem' }));
    const config = buildDatabaseConfig({ MYSQL_SSL: 'true' });
    assert.equal((config.ssl as any).rejectUnauthorized, true);
    assert.equal((config.ssl as any).verifyIdentity, true);
  });

  test('production initialization never assigns unlinked accounts to a demo tenant and scrubs plaintext in both tables', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_DEMO_SEEDS = 'true';
    process.env.DEMO_SEED_PASSWORD = 'fixture-password';
    process.env.MYSQL_SSL = 'true';
    queryResult = initializationQueries;
    assert.equal(await db.initDatabase(), true);
    assert.ok(!queries.some(({ sql }) => /SET institution_id = 'inst-dps-2026'/.test(sql)));
    assert.ok(!queries.some(({ sql }) => /INSERT INTO institutions/.test(sql)));
    for (const table of ['users', 'institutions']) {
      assert.ok(queries.some(({ sql }) => sql.includes(`UPDATE ${table} SET password = NULL WHERE password_hash IS NOT NULL`)));
      assert.ok(queries.some(({ sql }) => sql.includes(`ALTER TABLE ${table} ALTER COLUMN password SET DEFAULT NULL`)));
    }
    assert.equal(connectionConfigs[0].ssl.rejectUnauthorized, true);
    assert.equal(connectionConfigs[0].ssl.verifyIdentity, true);
  });

  test('credential migration failures stop initialization instead of reporting success', async () => {
    queryResult = async (sql) => {
      if (sql.includes('SELECT id, password FROM institutions')) throw Object.assign(new Error('fixture migration failure'), { code: 'ER_TABLEACCESS_DENIED_ERROR' });
      return initializationQueries(sql);
    };
    assert.equal(await db.initDatabase(), false);
    assert.ok(!queries.some(({ sql }) => sql.includes('CREATE TABLE IF NOT EXISTS student_progress')));
  });

  test('only duplicate-column errors are ignored during schema migrations', async () => {
    queryResult = async (sql) => {
      if (sql.includes('ADD COLUMN')) throw Object.assign(new Error('fixture existing column'), { code: 'ER_DUP_FIELDNAME' });
      return initializationQueries(sql);
    };
    assert.equal(await db.initDatabase(), true);
    queryResult = async (sql) => {
      if (sql.includes('ADD COLUMN')) throw Object.assign(new Error('fixture denied migration'), { code: 'ER_TABLEACCESS_DENIED_ERROR' });
      return initializationQueries(sql);
    };
    assert.equal(await db.initDatabase(), false);
  });

  test('legacy credentials beyond bcrypt byte limit are removed and require setup, never silently truncated', async () => {
    queryResult = async (sql) => {
      if (sql.includes('SELECT id, password FROM institutions')) return [[{ id: 'fixture-legacy', password: 'é'.repeat(37) }]];
      return initializationQueries(sql);
    };
    assert.equal(await db.initDatabase(), true);
    assert.equal(hashMock.mock.calls.length, 0);
    assert.ok(queries.some(({ sql, params }) => sql.includes('UPDATE institutions SET password = NULL, needs_password = TRUE') && params[0] === 'fixture-legacy'));
  });

  test('production administrator-created users remain tenantless without explicit institution allocation', async () => {
    process.env.NODE_ENV = 'production';
    const result = await db.adminCreateUser({ name: 'Fixture', email: 'new@example.test', role: 'student' });
    assert.equal(result.success, true);
    const insert = writes().find(({ sql }) => sql.startsWith('INSERT INTO users'))!;
    assert.equal(insert.params[7], null);
    assert.equal(insert.params[8], null);
    assert.equal(insert.params[9], null);
    assert.equal(result.user.institutionId, undefined);
  });

  test('institution password writes preserve exact whitespace, use bcrypt12 and redact the audit trail', async () => {
    queryResult = async (sql) => sql.includes('FROM institutions i')
      ? [[{ ...institution, email: 'institution@example.test', created_at: 'fixture-date' }]]
      : [{ affectedRows: 1 }];
    const password = ' fixture-password ';
    assert.equal((await db.updateInstitution('tenant-a', { password })).success, true);
    assert.equal(hashMock.mock.calls[0].arguments[0], password);
    assert.equal(hashMock.mock.calls[0].arguments[1], 12);
    assert.match(writes()[0].sql, /password = NULL/);
    const audit = queries.find(({ sql }) => sql.includes('INSERT INTO system_audit_logs'))!;
    assert.equal(JSON.parse(audit.params[6]).password, '[REDACTED]');
    queries.length = 0;
    hashMock.mock.resetCalls();
    const result = await db.createInstitution({ code: 'FIXTURE', name: 'Fixture', email: 'new@example.test', password: 'é'.repeat(37) });
    assert.equal(result.success, false);
    assert.equal(queries.length, 0);
    assert.equal(hashMock.mock.calls.length, 0);
  });

  test('database legacy self-enrollment is disabled outside explicitly opted-in development', async () => {
    for (const environment of ['production', 'staging', 'test', 'development']) {
      process.env.NODE_ENV = environment;
      process.env.ENABLE_LEGACY_AUTH = environment === 'development' ? 'false' : 'true';
      await assert.rejects(db.authenticateOrEnrollUser({ name: 'Fixture', role: 'admin' }), ResourceAccessError);
    }
    assert.equal(queries.length, 0);
  });

  test('enrollment rejects cross-tenant IDs/email and staff accounts before any mutation', async () => {
    for (const existing of [
      { ...existingStudent, institution_id: 'tenant-b' },
      { ...existingStudent, role: 'admin' },
      { ...existingStudent, role: 'teacher' },
    ]) {
      queries.length = 0;
      queryResult = async (sql) => sql.includes('FROM users WHERE id = ? OR LOWER(email)') ? [[existing]] : enrollmentQueries(sql);
      await assert.rejects(db.enrollStudentInCohortDb({ name: 'Fixture', id: existing.id, email: existing.email }, teacher), ResourceAccessError);
      assert.equal(writes().length, 0);
    }
    assert.equal(rollbacks, 3);
    assert.equal(releases, 3);
  });

  test('enrollment refuses conflicting ID and email targets even within the same tenant', async () => {
    queryResult = async (sql) => sql.includes('FROM users WHERE id = ? OR LOWER(email)') ? [[existingStudent]] : enrollmentQueries(sql);
    await assert.rejects(db.enrollStudentInCohortDb({ id: 'different-id', name: 'Fixture', email: existingStudent.email }, teacher), ResourceAccessError);
    assert.equal(writes().length, 0);
  });

  test('own-tenant enrollment uses canonical institution metadata and a student/tenant UPDATE predicate', async () => {
    queryResult = async (sql) => sql.includes('FROM users WHERE id = ? OR LOWER(email)') ? [[existingStudent]] : enrollmentQueries(sql);
    const result = await db.enrollStudentInCohortDb({ id: existingStudent.id, name: 'Fixture', email: existingStudent.email, institution: 'Forged School', overallMastery: 0 }, teacher);
    assert.equal(result.success, true);
    assert.equal(result.student.institution, 'Tenant A');
    assert.equal(result.student.institutionId, 'tenant-a');
    assert.equal(result.student.overallMastery, 0);
    const update = writes().find(({ sql }) => sql.startsWith('UPDATE users'))!;
    assert.match(update.sql, /role = 'student' AND institution_id <=> \?/);
    assert.equal(update.params.at(-1), 'tenant-a');
    assert.equal(commits, 1);
  });

  test('new-account insert never uses a duplicate-key overwrite, and a racing conflict rolls back', async () => {
    queryResult = async (sql) => {
      if (sql.startsWith('INSERT INTO users')) {
        assert.ok(!sql.includes('ON DUPLICATE KEY UPDATE'));
        throw Object.assign(new Error('fixture duplicate'), { code: 'ER_DUP_ENTRY' });
      }
      return enrollmentQueries(sql);
    };
    const result = await db.enrollStudentInCohortDb({ name: 'Fixture', email: 'new@example.test' }, teacher);
    assert.equal(result.success, false);
    assert.equal(rollbacks, 1);
    assert.ok(!queries.some(({ sql }) => sql.includes('INSERT INTO student_progress')));
  });

  test('unscoped management helpers reject absent actors and teachers without a tenant', async () => {
    await assert.rejects(db.enrollStudentInCohortDb({ name: 'Fixture' }), ResourceAccessError);
    await assert.rejects(db.deleteCohortStudentFromDb('student-a', { id: 'teacher', role: 'teacher' }), ResourceAccessError);
    await assert.rejects(db.deployTeacherInterventionInDb({ conceptTitle: 'Algebra' }), ResourceAccessError);
    await assert.rejects(db.saveCurriculumNodeToDb(node), ResourceAccessError);
    await assert.rejects(db.deleteCurriculumNodeFromDb(node.id), ResourceAccessError);
    assert.equal(queries.length, 0);
  });

  test('student deletion locks and predicates every mutation on student role and tenant', async () => {
    queryResult = async (sql) => sql.startsWith('SELECT') ? [[{ id: 'student-a' }]] : [{ affectedRows: 1 }];
    assert.equal(await db.deleteCohortStudentFromDb('student-a', teacher), true);
    assert.match(queries[0].sql, /FOR UPDATE/);
    assert.equal(writes().length, 4);
    for (const { sql, params } of writes()) {
      assert.match(sql, /u.role = 'student'/);
      assert.match(sql, /u.institution_id = \?/);
      assert.deepEqual(params, ['student-a', 'tenant-a']);
    }
  });

  test('institution member removal cannot decouple an account belonging to another tenant', async () => {
    queryResult = async () => [[]];
    const result = await db.removeInstitutionMember('tenant-a', 'student-b');
    assert.equal(result.success, false);
    assert.equal(writes().length, 0);
    assert.deepEqual(queries[0].params, ['student-b', 'tenant-a']);
    assert.match(queries[0].sql, /institution_id = \?/);
  });

  test('successful institution removal clears stale display bindings and predicates both updates', async () => {
    queryResult = async (sql) => sql.startsWith('SELECT') ? [[{ id: 'student-a' }]] : [{ affectedRows: 1 }];
    assert.equal((await db.removeInstitutionMember('tenant-a', 'student-a')).success, true);
    const updates = writes().filter(({ sql }) => sql.startsWith('UPDATE'));
    assert.equal(updates.length, 2);
    for (const { sql, params } of updates) {
      assert.match(sql, /institution = NULL/);
      assert.match(sql, /WHERE id = \? AND institution_id = \?/);
      assert.deepEqual(params, ['student-a', 'tenant-a']);
    }
  });

  test('institution memberships no longer accept a matching display name/code as ownership', async () => {
    queryResult = async (sql) => sql.includes('FROM institutions i') ? [[{ ...institution, created_at: 'fixture-date' }]] : [[]];
    await db.getInstitutionMembers('tenant-a');
    assert.ok(queries.length >= 3);
    for (const { sql } of queries) {
      assert.ok(!sql.includes('LOWER(u.institution)'));
      assert.ok(!sql.includes('UPPER(u.institution_code)'));
    }
  });

  test('all three analytics queries bind the same tenant, including OR-based at-risk counts', async () => {
    queryResult = async () => [[]];
    await db.getCurriculumBottlenecksFromDb('tenant-a');
    assert.equal(queries.length, 3);
    for (const { sql, params } of queries) {
      assert.match(sql, /u.institution_id = \?/);
      assert.deepEqual(params, ['tenant-a']);
    }
    assert.match(queries[2].sql, /\(c.status = 'Needs Intervention' OR c.overall_mastery < 60\)/);
  });

  test('intervention selects and updates only actor tenant and reports actual zero impact', async () => {
    const concepts = { Mathematics: [{ title: 'Algebra', status: 'in_progress' }] };
    queryResult = async (sql) => sql.startsWith('SELECT') ? [[{ user_id: 'student-a', concepts_json: JSON.stringify(concepts) }]] : [{ affectedRows: 1 }];
    assert.equal((await db.deployTeacherInterventionInDb({ conceptTitle: 'Algebra', teacherId: 'forged-teacher' }, teacher)).impactedCount, 1);
    for (const { sql, params } of queries) {
      assert.match(sql, /u.institution_id = \?/);
      assert.equal(params.at(-1), 'tenant-a');
    }
    queryResult = async () => [[]];
    assert.equal((await db.deployTeacherInterventionInDb({ conceptTitle: 'Absent' }, teacher)).impactedCount, 0);
  });

  test('teachers cannot overwrite other owners or system curriculum even by forging createdBy', async () => {
    for (const existing of [{ created_by: 'other-teacher', is_custom: 1 }, { created_by: teacher.id, is_custom: 0 }]) {
      queries.length = 0;
      queryResult = async () => [[existing]];
      assert.equal(await db.saveCurriculumNodeToDb({ ...node, createdBy: teacher.id }, teacher), false);
      assert.equal(writes().length, 0);
    }
  });

  test('new curriculum ownership is server-set and own updates/deletes carry SQL owner predicates', async () => {
    queryResult = async (sql) => sql.startsWith('SELECT') ? [[]] : [{ affectedRows: 1 }];
    assert.equal(await db.saveCurriculumNodeToDb(node, teacher), true);
    assert.equal(writes()[0].params.at(-1), teacher.id);
    assert.ok(!writes()[0].params.includes('forged-owner'));
    queries.length = 0;
    queryResult = async (sql) => sql.startsWith('SELECT') ? [[{ created_by: teacher.id, is_custom: 1 }]] : [{ affectedRows: 1 }];
    assert.equal(await db.saveCurriculumNodeToDb(node, teacher), true);
    assert.match(writes()[0].sql, /created_by = \? AND is_custom = TRUE/);
    assert.equal(await db.deleteCurriculumNodeFromDb(node.id, teacher), true);
    assert.deepEqual(writes().at(-1)!.params, [node.id, teacher.id]);
  });

  test('public curriculum reads hide custom teacher records; explicit admin context retains global management', async () => {
    queryResult = async (sql) => sql.startsWith('SELECT') ? [[]] : [{ affectedRows: 1 }];
    await db.getCurriculumNodesFromDb();
    assert.match(queries[0].sql, /WHERE is_custom = FALSE/);
    await db.getCurriculumNodesFromDb(undefined, undefined, teacher);
    assert.match(queries[1].sql, /is_custom = FALSE OR created_by = \?/);
    assert.deepEqual(queries[1].params, [teacher.id]);
    assert.equal(await db.deleteCurriculumNodeFromDb(node.id, admin), true);
    assert.deepEqual(writes()[0].params, [node.id]);
  });

  test('audit writes redact nested passwords, hashes, keys, tokens and serialized JSON without mutating input', async () => {
    const details = {
      name: 'Fixture institution', password: 'fixture-plain',
      changes: [{ old_password_hash: 'fixture-hash', accessToken: 'fixture-token' }],
      setting: { key: 'gemini_api_key', value: 'fixture-api-key' },
      serialized: JSON.stringify({ nested: { clientSecret: 'fixture-client-secret', enabled: true } }),
    };
    await db.logSystemAction({ action: 'FIXTURE_ACTION', details });
    const written = JSON.parse(queries[0].params[6]);
    assert.equal(written.password, '[REDACTED]');
    assert.equal(written.changes[0].old_password_hash, '[REDACTED]');
    assert.equal(written.changes[0].accessToken, '[REDACTED]');
    assert.equal(written.setting.value, '[REDACTED]');
    assert.equal(written.serialized.nested.clientSecret, '[REDACTED]');
    assert.equal(written.serialized.nested.enabled, true);
    assert.equal(details.password, 'fixture-plain');
    const circular: any = { password: 'fixture-value' };
    circular.self = circular;
    assert.doesNotThrow(() => JSON.stringify(redactAuditDetails(circular)));
  });

  test('a DB outage in ownership checks cannot masquerade as a missing/not-owned student', async () => {
    queryResult = async () => { throw Object.assign(new Error('fixture driver failure'), { code: 'ECONNREFUSED' }); };
    await assert.rejects(db.isUserInInstitution('student-a', 'tenant-a'), DatabaseUnavailableError);
    await assert.rejects(db.enrollStudentInCohortDb({ name: 'Fixture' }, teacher), DatabaseUnavailableError);
    await assert.rejects(db.deleteCurriculumNodeFromDb(node.id, teacher), DatabaseUnavailableError);
  });
});
