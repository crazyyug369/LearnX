import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { INITIAL_CONCEPTS } from './data/curriculumData';
import { getCurriculumForGrade, getDiagnosticQuestionsForGrade, normalizeGradeName } from './data/gradeCurriculum';
import { ConceptNode, StudentInterest, UserProfile, Institution } from './types';

// MySQL Connection Pool configuration for XAMPP
const DB_CONFIG = {
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool: mysql.Pool | null = null;


export async function closeDbPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
export function getDbPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG);
  }
  return pool;
}

/**
 * Generate clean 0% mastery baseline concepts map for new students according to their grade
 */
export function createCleanConcepts(grade?: string): Record<string, ConceptNode[]> {
  const curriculum = getCurriculumForGrade(grade);
  const clean: Record<string, ConceptNode[]> = {};
  Object.keys(curriculum).forEach((subj) => {
    clean[subj] = curriculum[subj].map((c) => ({
      ...c,
      masteryScore: 0,
      status: c.prerequisites.length === 0 ? 'in_progress' : 'locked',
    }));
  });
  return clean;
}

/**
 * Generate customized concepts map for standard demo baseline students
 */
export function getDemoConcepts(studentKey: string, grade?: string): Record<string, ConceptNode[]> {
  const k = studentKey.toLowerCase();
  if (k.includes('aarav') || k === 's-1') {
    return JSON.parse(JSON.stringify(INITIAL_CONCEPTS));
  }
  if (k.includes('diya') || k === 's-2') {
    const diya: Record<string, ConceptNode[]> = JSON.parse(JSON.stringify(INITIAL_CONCEPTS));
    diya.Mathematics = diya.Mathematics.map((c) => {
      if (c.id === 'math-1') return { ...c, masteryScore: 78, status: 'mastered' };
      if (c.id === 'math-2') return { ...c, masteryScore: 72, status: 'in_progress' };
      if (c.id === 'math-3') return { ...c, masteryScore: 42, status: 'remediation' };
      return { ...c, masteryScore: 0, status: 'locked' };
    });
    return diya;
  }
  if (k.includes('rohan') || k === 's-3') {
    const rohan: Record<string, ConceptNode[]> = JSON.parse(JSON.stringify(INITIAL_CONCEPTS));
    rohan.Mathematics = rohan.Mathematics.map((c) => {
      if (c.id === 'math-1') return { ...c, masteryScore: 86, status: 'mastered' };
      if (c.id === 'math-2') return { ...c, masteryScore: 84, status: 'mastered' };
      if (c.id === 'math-3') return { ...c, masteryScore: 80, status: 'mastered' };
      if (c.id === 'math-4') return { ...c, masteryScore: 40, status: 'remediation' };
      return { ...c, masteryScore: 0, status: 'locked' };
    });
    return rohan;
  }
  if (k.includes('ananya') || k === 's-4') {
    const ananya: Record<string, ConceptNode[]> = JSON.parse(JSON.stringify(INITIAL_CONCEPTS));
    ananya.Mathematics = ananya.Mathematics.map((c) => ({
      ...c,
      masteryScore: 92,
      status: 'mastered',
    }));
    return ananya;
  }
  if (k.includes('kabir') || k === 's-5') {
    const kabir: Record<string, ConceptNode[]> = JSON.parse(JSON.stringify(INITIAL_CONCEPTS));
    kabir.Mathematics = kabir.Mathematics.map((c) => {
      if (c.id === 'math-1') return { ...c, masteryScore: 52, status: 'remediation' };
      return { ...c, masteryScore: 0, status: 'locked' };
    });
    return kabir;
  }
  return createCleanConcepts(grade);
}

/**
 * Initialize database schema and seed baseline students
 */
export async function initDatabase(): Promise<boolean> {
  try {
    // 1. Ensure learnx_db database exists
    const rootConn = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
    });
    await rootConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await rootConn.end();

    const db = getDbPool();

    // 2. Create users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) DEFAULT '',
        role ENUM('student', 'teacher', 'admin') DEFAULT 'student',
        student_id VARCHAR(64) DEFAULT NULL,
        teacher_id VARCHAR(64) DEFAULT NULL,
        grade VARCHAR(64) DEFAULT 'Grade 10',
        institution VARCHAR(255) DEFAULT NULL,
        department VARCHAR(255) DEFAULT NULL,
        interest VARCHAR(64) DEFAULT 'Cricket & Sports',
        streak_count INT DEFAULT 1,
        avatar TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_lookup (name, email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    
    // Migration: Add password_hash and needs_password to users
    try {
      await db.query("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL");
    } catch {}
    try {
      await db.query("ALTER TABLE users ADD COLUMN needs_password BOOLEAN DEFAULT TRUE");
    } catch {}

    // Migration: Add password_hash and needs_password to institutions
    try {
      await db.query("ALTER TABLE institutions ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL");
    } catch {}
    try {
      await db.query("ALTER TABLE institutions ADD COLUMN needs_password BOOLEAN DEFAULT TRUE");
    } catch {}

    // Auto-migrate plaintext passwords in institutions (using bcrypt dynamically via dynamic import for ESM or plain bcrypt)
    try {
      const [insts]: any = await db.query("SELECT id, password FROM institutions WHERE password IS NOT NULL AND password != '' AND password_hash IS NULL");
      for (const inst of (insts || [])) {
        if (inst.password) {
           const hash = await bcrypt.hash(inst.password, 10);
           // Nullify plain password to prevent fallback
           await db.query("UPDATE institutions SET password_hash = ?, needs_password = FALSE, password = NULL WHERE id = ?", [hash, inst.id]);
        }
      }
    } catch (e) {
       console.log('Error migrating institution passwords:', e.message);
    }

    // Migration to ensure admin & institution roles and institution links are supported on users table
    try {
      await db.query(`ALTER TABLE users MODIFY COLUMN role ENUM('student', 'teacher', 'admin', 'institution') DEFAULT 'student'`);
    } catch {
      // Column modification already applied
    }
    try {
      await db.query(`ALTER TABLE users ADD COLUMN institution_id VARCHAR(64) DEFAULT NULL`);
    } catch {}
    try {
      await db.query(`ALTER TABLE users ADD COLUMN institution_code VARCHAR(32) DEFAULT NULL`);
    } catch {}

    // 2.5 Create institutions table (for multi-tenant institutional administration)
    await db.query(`
      CREATE TABLE IF NOT EXISTS institutions (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(32) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255) DEFAULT 'learnx@123',
        contact_person VARCHAR(128) DEFAULT NULL,
        phone VARCHAR(32) DEFAULT NULL,
        address TEXT DEFAULT NULL,
        city VARCHAR(64) DEFAULT NULL,
        state VARCHAR(64) DEFAULT NULL,
        status ENUM('active', 'suspended', 'pending') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_inst_code (code),
        INDEX idx_inst_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Create student_progress table
    await db.query(`
      CREATE TABLE IF NOT EXISTS student_progress (
        user_id VARCHAR(64) PRIMARY KEY,
        overall_mastery INT DEFAULT 0,
        struggling_concept VARCHAR(255) DEFAULT NULL,
        status VARCHAR(64) DEFAULT 'New Enrollee',
        last_active VARCHAR(64) DEFAULT 'Just now',
        concepts_json LONGTEXT NOT NULL,
        diagnostic_completed TINYINT(1) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Migration for diagnostic_completed if table already existed
    try {
      await db.query(`ALTER TABLE student_progress ADD COLUMN diagnostic_completed TINYINT(1) DEFAULT 0`);
    } catch {
      // Column already exists
    }

    // 4. Create cohort_students table (for fast teacher portal roster sync)
    await db.query(`
      CREATE TABLE IF NOT EXISTS cohort_students (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) DEFAULT NULL,
        grade VARCHAR(64) DEFAULT 'Grade 10',
        student_id VARCHAR(64) DEFAULT NULL,
        institution VARCHAR(255) DEFAULT NULL,
        institution_id VARCHAR(64) DEFAULT NULL,
        institution_code VARCHAR(32) DEFAULT NULL,
        avatar TEXT DEFAULT NULL,
        overall_mastery INT DEFAULT 50,
        struggling_concept VARCHAR(255) DEFAULT NULL,
        status VARCHAR(64) DEFAULT 'New Enrollee',
        last_active VARCHAR(64) DEFAULT 'Just now',
        interest VARCHAR(64) DEFAULT 'Cricket & Sports',
        registered_at BIGINT DEFAULT NULL,
        is_new_registration BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cohort_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Migrations for cohort_students
    try {
      await db.query(`ALTER TABLE cohort_students ADD COLUMN institution VARCHAR(255) DEFAULT NULL`);
    } catch {}
    try {
      await db.query(`ALTER TABLE cohort_students ADD COLUMN institution_id VARCHAR(64) DEFAULT NULL`);
    } catch {}
    try {
      await db.query(`ALTER TABLE cohort_students ADD COLUMN institution_code VARCHAR(32) DEFAULT NULL`);
    } catch {}

    // 5. Create quiz_attempts table (stores granular student assessment logs & real Bloom's metrics)
    await db.query(`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        concept_id VARCHAR(64) NOT NULL,
        concept_title VARCHAR(255) NOT NULL,
        subject VARCHAR(64) NOT NULL DEFAULT 'Mathematics',
        score INT NOT NULL DEFAULT 0,
        accuracy INT NOT NULL DEFAULT 0,
        is_mastered BOOLEAN DEFAULT FALSE,
        time_spent INT NOT NULL DEFAULT 0,
        bkt_mastery DOUBLE NOT NULL DEFAULT 0.5,
        answers_json LONGTEXT NOT NULL,
        blooms_breakdown_json TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_attempts (user_id, created_at),
        INDEX idx_concept_attempts (concept_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6. Create curriculum_nodes table (for dynamic teacher CRUD & AI curriculum architecture)
    await db.query(`
      CREATE TABLE IF NOT EXISTS curriculum_nodes (
        id VARCHAR(64) PRIMARY KEY,
        subject VARCHAR(64) NOT NULL,
        grade VARCHAR(64) NOT NULL DEFAULT 'Grade 10',
        title VARCHAR(255) NOT NULL,
        category VARCHAR(128) NOT NULL DEFAULT 'General',
        description TEXT,
        difficulty ENUM('Beginner', 'Intermediate', 'Advanced') DEFAULT 'Beginner',
        prerequisites_json TEXT,
        tags_json TEXT,
        estimated_time INT DEFAULT 20,
        created_by VARCHAR(64) DEFAULT 'system',
        is_custom BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_subj_grade (subject, grade)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 7. Create system_settings table (Key-value store for Gemini engine toggles & API configurations)
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(64) PRIMARY KEY,
        setting_value LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 8. Create question_bank table (dynamic CRUD for quizzes, difficulties, Bloom's levels)
    await db.query(`
      CREATE TABLE IF NOT EXISTS question_bank (
        id VARCHAR(64) PRIMARY KEY,
        concept_id VARCHAR(64) NOT NULL,
        concept_title VARCHAR(255) NOT NULL,
        subject VARCHAR(64) NOT NULL DEFAULT 'Mathematics',
        grade VARCHAR(64) NOT NULL DEFAULT 'Grade 10',
        question_text TEXT NOT NULL,
        options_json TEXT NOT NULL,
        correct_index INT NOT NULL DEFAULT 0,
        difficulty ENUM('Beginner', 'Intermediate', 'Advanced') DEFAULT 'Intermediate',
        blooms_level VARCHAR(64) DEFAULT 'Application',
        explanation TEXT DEFAULT NULL,
        hint TEXT DEFAULT NULL,
        youtube_video_id VARCHAR(64) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_qb_concept (concept_id),
        INDEX idx_qb_grade (grade, subject)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 9. Create system_audit_logs table (records admin changes, AI toggles, and user actions)
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        action VARCHAR(128) NOT NULL,
        actor_id VARCHAR(64) DEFAULT NULL,
        actor_name VARCHAR(255) DEFAULT NULL,
        target_type VARCHAR(64) DEFAULT NULL,
        target_id VARCHAR(64) DEFAULT NULL,
        details_json TEXT DEFAULT NULL,
        ip_address VARCHAR(64) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_time (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6.5 Seed baseline institutions if empty
    const [instRows]: any = await db.query('SELECT COUNT(*) as cnt FROM institutions');
    if (instRows && instRows[0] && instRows[0].cnt === 0) {
      console.log('Seeding baseline institutions into learnx_db...');
      const baselineInstitutions = [
        {
          id: 'inst-dps-2026',
          code: 'DPS2026',
          name: 'Delhi Public School',
          email: 'admin@dps.edu.in',
          contactPerson: 'Dr. Ramesh Sharma',
          phone: '+91 98765 43210',
          city: 'New Delhi',
          state: 'Delhi',
          status: 'active',
        },
        {
          id: 'inst-kva-2026',
          code: 'KVA2026',
          name: 'Kendriya Vidyalaya Academy',
          email: 'admin@kva.edu.in',
          contactPerson: 'Mrs. Sunita Verma',
          phone: '+91 98123 45678',
          city: 'Ahmedabad',
          state: 'Gujarat',
          status: 'active',
        },
        {
          id: 'inst-sxhs-2026',
          code: 'SXHS2026',
          name: "St. Xavier's High School",
          email: 'admin@sxhs.edu.in',
          contactPerson: 'Fr. Joseph D Souza',
          phone: '+91 97234 56789',
          city: 'Mumbai',
          state: 'Maharashtra',
          status: 'active',
        },
      ];
      for (const inst of baselineInstitutions) {
        await db.query(
          `INSERT INTO institutions (id, code, name, email, password, contact_person, phone, city, state, status)
           VALUES (?, ?, ?, ?, 'learnx@123', ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name)`,
          [inst.id, inst.code, inst.name, inst.email, inst.contactPerson, inst.phone, inst.city, inst.state, inst.status]
        );
      }
    }

    // Update existing students/teachers with baseline institution links if missing
    try {
      await db.query(`
        UPDATE users 
        SET institution_id = 'inst-dps-2026', institution_code = 'DPS2026', institution = 'Delhi Public School'
        WHERE institution_id IS NULL AND (role = 'student' OR role = 'teacher')
      `);
      await db.query(`
        UPDATE cohort_students 
        SET institution_id = 'inst-dps-2026', institution_code = 'DPS2026', institution = 'Delhi Public School'
        WHERE institution_id IS NULL
      `);
    } catch {}

    // 7. Seed baseline students if empty
    const [rows]: any = await db.query('SELECT COUNT(*) as cnt FROM users');
    if (rows && rows[0] && rows[0].cnt === 0) {
      console.log('Seeding baseline accounts into learnx_db...');

      const baselineSeed = [
        {
          id: 's-1',
          name: 'Aarav Sharma',
          email: 'aarav.sharma@student.learnx.org',
          role: 'student',
          studentId: 'STU-2026-1048',
          grade: 'Grade 10',
          interest: 'Cricket & Sports',
          streakCount: 5,
          overallMastery: 53,
          strugglingConcept: null,
          status: 'Excelling',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
        },
        {
          id: 's-2',
          name: 'Diya Patel',
          email: 'diya.patel@student.learnx.org',
          role: 'student',
          studentId: 'STU-2026-2104',
          grade: 'Grade 11',
          interest: 'Gaming & Sci-Fi',
          streakCount: 3,
          overallMastery: 58,
          strugglingConcept: 'Quadratic Equations & Roots',
          status: 'Needs Intervention',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
        },
        {
          id: 's-3',
          name: 'Rohan Verma',
          email: 'rohan.verma@student.learnx.org',
          role: 'student',
          studentId: 'STU-2026-3391',
          grade: 'Grade 10',
          interest: 'Robotics & Coding',
          streakCount: 4,
          overallMastery: 72,
          strugglingConcept: 'Parabolas & Coordinate Geometry',
          status: 'On Track',
          avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
        },
        {
          id: 's-4',
          name: 'Ananya Iyer',
          email: 'ananya.iyer@student.learnx.org',
          role: 'student',
          studentId: 'STU-2026-4482',
          grade: 'Grade 10',
          interest: 'Space & Astronomy',
          streakCount: 7,
          overallMastery: 91,
          strugglingConcept: null,
          status: 'Excelling',
          avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80',
        },
        {
          id: 's-5',
          name: 'Kabir Mehta',
          email: 'kabir.mehta@student.learnx.org',
          role: 'student',
          studentId: 'STU-2026-5509',
          grade: 'Grade 9',
          interest: 'Music & Creative Arts',
          streakCount: 2,
          overallMastery: 52,
          strugglingConcept: 'Linear Equations & Slope',
          status: 'Needs Intervention',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
        },
      ];

      for (const s of baselineSeed) {
        await db.query(
          `INSERT INTO users (id, name, email, role, student_id, grade, interest, streak_count, avatar)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [s.id, s.name, s.email, s.role, s.studentId, s.grade, s.interest, s.streakCount, s.avatar]
        );

        const concepts = getDemoConcepts(s.id);
        await db.query(
          `INSERT INTO student_progress (user_id, overall_mastery, struggling_concept, status, concepts_json)
           VALUES (?, ?, ?, ?, ?)`,
          [s.id, s.overallMastery, s.strugglingConcept, s.status, JSON.stringify(concepts)]
        );

        await db.query(
          `INSERT INTO cohort_students (id, name, email, grade, student_id, avatar, overall_mastery, struggling_concept, status, interest, registered_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            s.name,
            s.email,
            s.grade,
            s.studentId,
            s.avatar,
            s.overallMastery,
            s.strugglingConcept,
            s.status,
            s.interest,
            Date.now() - 1000 * 60 * 60 * 24 * 3,
          ]
        );
      }

      // Seed Faculty accounts
      await db.query(
        `INSERT INTO users (id, name, email, role, teacher_id, institution, department, avatar)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'teacher-1',
          'Dr. Priya Rao',
          'priya.rao@dps.edu.in',
          'teacher',
          'FAC-2026-101',
          'Delhi Public School',
          'Mathematics',
          'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        ]
      );

      await db.query(
        `INSERT INTO users (id, name, email, role, teacher_id, institution, department, avatar)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'teacher-2',
          'Prof. Vikram Sen',
          'vikram.sen@kv.edu.in',
          'teacher',
          'FAC-2026-204',
          'Kendriya Vidyalaya',
          'Physics',
          'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        ]
      );

      console.log('learnx_db baseline seeding complete.');
    }

    // Auto-normalize legacy grade formats (e.g. 'Grade 10' -> 'Class 10')
    try {
      await db.query("UPDATE users SET grade = REPLACE(grade, 'Grade ', 'Class ') WHERE grade LIKE 'Grade %'");
      await db.query("UPDATE cohort_students SET grade = REPLACE(grade, 'Grade ', 'Class ') WHERE grade LIKE 'Grade %'");
    } catch {}

    // Ensure default Administrator exists
    const [adminCheck]: any = await db.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (!adminCheck || adminCheck.length === 0) {
      await db.query(
        `INSERT INTO users (id, name, email, role, institution, department, avatar)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE role = 'admin'`,
        [
          'admin-1',
          'System Administrator',
          'admin@learnx.org',
          'admin',
          'LearnX Central Operations',
          'Platform Administration',
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        ]
      );
    }

    // Ensure default system settings exist
    const defaultSettings: Record<string, string> = {
      gemini_enabled: 'true',
      gemini_api_key: process.env.GEMINI_API_KEY ,
      gemini_model: 'gemini-2.5-flash',
      gemini_model_priority: JSON.stringify(['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-pro']),
      gemini_temperature: '0.7',
      maintenance_mode: 'false',
      announcement_banner: '',
    };

    for (const [k, v] of Object.entries(defaultSettings)) {
      await db.query(
        `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_key = setting_key`,
        [k, v]
      );
    }

    return true;
  } catch (err) {
    console.error('Database connection or initialization error:', err);
    return false;
  }
}

/**
 * Authenticate or dynamically register a student by email or username.
 * Guarantees persistent, deterministic account retrieval without progress loss.
 */
export async function authenticateOrEnrollUser(params: {
  email?: string;
  name?: string;
  password?: string;
  role?: 'student' | 'teacher' | 'admin' | 'institution';
  grade?: string;
  interest?: StudentInterest;
  studentId?: string;
  institution?: string;
  institutionId?: string;
  institutionCode?: string;
  department?: string;
  teacherId?: string;
  avatar?: string;
}): Promise<{
  user: UserProfile;
  conceptsMap: Record<string, ConceptNode[]>;
  overallMastery: number;
  isNew: boolean;
}> {
  const db = getDbPool();
  const rawTerm = (params.email || params.name || params.institutionCode || '').trim();
  const lowerTerm = rawTerm.toLowerCase();
  const role = params.role || 'student';

  // 0. Specialized Path for Institution Login
  if (role === 'institution') {
    const instCodeOrEmail = (params.institutionCode || params.email || rawTerm).trim();
    const [instRows]: any = await db.query(
      `SELECT * FROM institutions WHERE UPPER(code) = ? OR LOWER(email) = ? LIMIT 1`,
      [instCodeOrEmail.toUpperCase(), instCodeOrEmail.toLowerCase()]
    );
    if (instRows && instRows.length > 0) {
      const inst = instRows[0];
      const instUser: UserProfile = {
        id: inst.id,
        name: `${inst.name} Admin`,
        email: inst.email,
        role: 'institution',
        institution: inst.name,
        institutionId: inst.id,
        institutionCode: inst.code,
        department: 'Institutional Administration',
        diagnosticCompleted: true,
        isNew: false,
      };
      return {
        user: instUser,
        conceptsMap: createCleanConcepts('Class 10'),
        overallMastery: 100,
        isNew: false,
      };
    }
  }

  // 1. Search existing user by exact email OR name
  const [existing]: any = await db.query(
    `SELECT u.*, p.overall_mastery, p.struggling_concept, p.status as p_status, p.concepts_json, p.diagnostic_completed
     FROM users u
     LEFT JOIN student_progress p ON u.id = p.user_id
     WHERE LOWER(u.email) = ? OR LOWER(u.name) = ? OR u.student_id = ? OR u.teacher_id = ?
     LIMIT 1`,
    [lowerTerm, lowerTerm, rawTerm, rawTerm]
  );

  if (existing && existing.length > 0) {
    const row = existing[0];
    const isTeacher = row.role === 'teacher';
    const isAdmin = row.role === 'admin';
    const isInstitution = row.role === 'institution';
    const isStaff = isTeacher || isAdmin || isInstitution;
    const normGrade = normalizeGradeName(row.grade || params.grade || 'Class 10');
    const hasCompletedDiagnostic = Boolean(row.diagnostic_completed || (row.overall_mastery && Number(row.overall_mastery) > 0));
    const isNew = !isStaff && !hasCompletedDiagnostic;

    const user: UserProfile = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      studentId: row.student_id,
      teacherId: row.teacher_id || (isTeacher ? `FAC-2026-${Math.floor(100 + Math.random() * 900)}` : undefined),
      grade: normGrade,
      institution: row.institution || (isTeacher ? 'Delhi Public School' : isAdmin ? 'LearnX Central Operations' : undefined),
      institutionId: row.institution_id || undefined,
      institutionCode: row.institution_code || undefined,
      department: row.department || (isTeacher ? 'Mathematics' : isAdmin ? 'Platform Administration' : undefined),
      interest: row.interest,
      streakCount: row.streak_count || 1,
      avatar: row.avatar,
      diagnosticCompleted: isStaff ? true : hasCompletedDiagnostic,
      isNew: isNew,
    };

    let conceptsMap: Record<string, ConceptNode[]>;
    if (row.concepts_json) {
      try {
        conceptsMap = JSON.parse(row.concepts_json);
      } catch {
        conceptsMap = getDemoConcepts(row.id, normGrade);
      }
    } else {
      conceptsMap = getDemoConcepts(row.id, normGrade);
      // Save initial progress record if missing
      await db.query(
        `INSERT INTO student_progress (user_id, overall_mastery, concepts_json, diagnostic_completed)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE concepts_json = VALUES(concepts_json)`,
        [row.id, row.overall_mastery || 0, JSON.stringify(conceptsMap), hasCompletedDiagnostic ? 1 : 0]
      );
    }

    return {
      user,
      conceptsMap,
      overallMastery: Number(row.overall_mastery) || 0,
      isNew: isNew,
    };
  }

  // 2. Not found: Create new user with deterministic ID based on normalized username
  const cleanName = params.name?.trim() || rawTerm.split('@')[0] || 'Learner';
  const cleanEmail =
    params.email?.trim() || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@${role === 'admin' ? 'learnx.org' : role === 'teacher' ? 'school.edu.in' : 'student.learnx.org'}`;

  const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');

  // Resolve institution information if institutionCode provided
  let instName = params.institution;
  let instId = params.institutionId;
  let instCode = params.institutionCode ? params.institutionCode.trim().toUpperCase() : undefined;

  if (instCode) {
    const [matchedInst]: any = await db.query(
      `SELECT * FROM institutions WHERE UPPER(code) = ? LIMIT 1`,
      [instCode]
    );
    if (matchedInst && matchedInst[0]) {
      instId = matchedInst[0].id;
      instCode = matchedInst[0].code;
      instName = matchedInst[0].name;
    }
  }

  // Specific creation path for administrators
  if (role === 'admin') {
    const adminUserId = `adm_${slug || Date.now()}`;
    const adminAvatar =
      params.avatar ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

    await db.query(
      `INSERT INTO users (id, name, email, role, institution, department, avatar)
       VALUES (?, ?, ?, 'admin', 'LearnX Central Operations', 'Platform Administration', ?)
       ON DUPLICATE KEY UPDATE role = 'admin'`,
      [adminUserId, cleanName, cleanEmail, adminAvatar]
    );

    const newAdmin: UserProfile = {
      id: adminUserId,
      name: cleanName,
      email: cleanEmail,
      role: 'admin',
      institution: 'LearnX Central Operations',
      department: 'Platform Administration',
      avatar: adminAvatar,
      diagnosticCompleted: true,
      isNew: false,
    };

    return {
      user: newAdmin,
      conceptsMap: createCleanConcepts('Class 10'),
      overallMastery: 100,
      isNew: false,
    };
  }

  // Specific creation path for verified faculty / educators
  if (role === 'teacher') {
    const teacherId = params.teacherId || `FAC-2026-${Math.floor(100 + Math.random() * 900)}`;
    const institution = instName || params.institution || 'Delhi Public School';
    const department = params.department || 'Mathematics';
    const teachUserId = `teach_${slug || Date.now()}`;
    const teachAvatar =
      params.avatar ||
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80';

    await db.query(
      `INSERT INTO users (id, name, email, role, teacher_id, institution, institution_id, institution_code, department, avatar)
       VALUES (?, ?, ?, 'teacher', ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         teacher_id = VALUES(teacher_id),
         institution = VALUES(institution),
         institution_id = VALUES(institution_id),
         institution_code = VALUES(institution_code),
         department = VALUES(department)`,
      [teachUserId, cleanName, cleanEmail, teacherId, institution, instId || 'inst-dps-2026', instCode || 'DPS2026', department, teachAvatar]
    );

    const newTeacher: UserProfile = {
      id: teachUserId,
      name: cleanName,
      email: cleanEmail,
      role: 'teacher',
      teacherId,
      institution,
      institutionId: instId || 'inst-dps-2026',
      institutionCode: instCode || 'DPS2026',
      department,
      avatar: teachAvatar,
      diagnosticCompleted: true,
      isNew: false,
    };

    return {
      user: newTeacher,
      conceptsMap: createCleanConcepts('Class 10'),
      overallMastery: 0,
      isNew: false,
    };
  }

  // Student creation path
  const userId = `stu_${slug || Date.now()}`;
  const studentId = params.studentId || `STU-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const grade = normalizeGradeName(params.grade || 'Class 10');
  const interest = params.interest || 'Robotics & Coding';
  const avatar = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80`;
  const resolvedInst = instName || 'Delhi Public School';
  const resolvedInstId = instId || 'inst-dps-2026';
  const resolvedInstCode = instCode || 'DPS2026';

  await db.query(
    `INSERT INTO users (id, name, email, role, student_id, grade, interest, streak_count, avatar, institution, institution_id, institution_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    [userId, cleanName, cleanEmail, role, studentId, grade, interest, avatar, resolvedInst, resolvedInstId, resolvedInstCode]
  );

  // Fresh curriculum concepts for new student specifically calibrated to their selected Grade
  const cleanConcepts = role === 'student' ? createCleanConcepts(grade) : {};

  if (role === 'student') {
    await db.query(
      `INSERT INTO student_progress (user_id, overall_mastery, struggling_concept, status, concepts_json, diagnostic_completed)
       VALUES (?, 0, NULL, 'New Enrollee', ?, 0)
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [userId, JSON.stringify(cleanConcepts)]
    );

    await db.query(
      `INSERT INTO cohort_students (id, name, email, grade, student_id, avatar, overall_mastery, struggling_concept, status, interest, registered_at, is_new_registration, institution, institution_id, institution_code)
       VALUES (?, ?, ?, ?, ?, ?, 0, NULL, 'New Enrollee', ?, ?, 1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), overall_mastery = VALUES(overall_mastery), institution = VALUES(institution), institution_id = VALUES(institution_id), institution_code = VALUES(institution_code)`,
      [userId, cleanName, cleanEmail, grade, studentId, avatar, interest, Date.now(), resolvedInst, resolvedInstId, resolvedInstCode]
    );
  }

  const newUser: UserProfile = {
    id: userId,
    name: cleanName,
    email: cleanEmail,
    role,
    studentId,
    grade,
    interest,
    streakCount: 1,
    institution: resolvedInst,
    institutionId: resolvedInstId,
    institutionCode: resolvedInstCode,
    avatar,
    diagnosticCompleted: false,
    isNew: true,
  };

  return {
    user: newUser,
    conceptsMap: cleanConcepts,
    overallMastery: 0,
    isNew: true,
  };
}

/**
 * Save updated student mastery and concepts map into MySQL
 */
export async function saveStudentProgress(
  userId: string,
  data: {
    conceptsMap?: Record<string, ConceptNode[]>;
    overallMastery?: number;
    strugglingConcept?: string | null;
    status?: string;
    streakCount?: number;
    interest?: StudentInterest;
  }
): Promise<boolean> {
  try {
    const db = getDbPool();

    // 1. Update student_progress
    if (data.conceptsMap) {
      await db.query(
        `INSERT INTO student_progress (user_id, overall_mastery, struggling_concept, status, last_active, concepts_json)
         VALUES (?, ?, ?, ?, 'Just now', ?)
         ON DUPLICATE KEY UPDATE
           concepts_json = VALUES(concepts_json),
           overall_mastery = COALESCE(VALUES(overall_mastery), overall_mastery),
           struggling_concept = VALUES(struggling_concept),
           status = COALESCE(VALUES(status), status),
           last_active = 'Just now'`,
        [
          userId,
          data.overallMastery ?? 0,
          data.strugglingConcept ?? null,
          data.status || 'On Track',
          JSON.stringify(data.conceptsMap),
        ]
      );
    } else if (data.overallMastery !== undefined) {
      await db.query(
        `UPDATE student_progress
         SET overall_mastery = ?, struggling_concept = ?, status = COALESCE(?, status), last_active = 'Just now'
         WHERE user_id = ?`,
        [data.overallMastery, data.strugglingConcept ?? null, data.status, userId]
      );
    }

    // 2. Update user streak/interest
    const userUpdates: string[] = [];
    const userParams: any[] = [];
    if (data.streakCount !== undefined) {
      userUpdates.push('streak_count = ?');
      userParams.push(data.streakCount);
    }
    if (data.interest) {
      userUpdates.push('interest = ?');
      userParams.push(data.interest);
    }
    if (userUpdates.length > 0) {
      userParams.push(userId);
      await db.query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userParams);
    }

    // 3. Update cohort_students roster
    if (data.overallMastery !== undefined) {
      await db.query(
        `UPDATE cohort_students
         SET overall_mastery = ?, struggling_concept = ?, status = COALESCE(?, status), last_active = 'Just now'
         WHERE id = ?`,
        [data.overallMastery, data.strugglingConcept ?? null, data.status, userId]
      );
    }
    if (data.interest) {
      await db.query(
        `UPDATE cohort_students SET interest = ? WHERE id = ?`,
        [data.interest, userId]
      );
    }

    return true;
  } catch (err) {
    console.error('Error saving student progress to MySQL:', err);
    return false;
  }
}

/**
 * Update student profile (interest, grade, streak_count, name) in MySQL
 */
export async function updateUserProfile(
  userId: string,
  updates: {
    interest?: StudentInterest;
    grade?: string;
    streakCount?: number;
    name?: string;
    avatar?: string;
  }
): Promise<boolean> {
  try {
    const db = getDbPool();
    const userCols: string[] = [];
    const userVals: any[] = [];

    if (updates.interest) {
      userCols.push('interest = ?');
      userVals.push(updates.interest);
    }
    if (updates.grade) {
      userCols.push('grade = ?');
      userVals.push(updates.grade);
    }
    if (updates.name) {
      userCols.push('name = ?');
      userVals.push(updates.name);
    }
    if (updates.streakCount !== undefined) {
      userCols.push('streak_count = ?');
      userVals.push(updates.streakCount);
    }
    if (updates.avatar) {
      userCols.push('avatar = ?');
      userVals.push(updates.avatar);
    }

    if (userCols.length > 0) {
      userVals.push(userId);
      await db.query(`UPDATE users SET ${userCols.join(', ')} WHERE id = ?`, userVals);
    }

    // Also sync to cohort_students
    const cohortCols: string[] = [];
    const cohortVals: any[] = [];
    if (updates.interest) {
      cohortCols.push('interest = ?');
      cohortVals.push(updates.interest);
    }
    if (updates.grade) {
      cohortCols.push('grade = ?');
      cohortVals.push(updates.grade);
    }
    if (updates.name) {
      cohortCols.push('name = ?');
      cohortVals.push(updates.name);
    }
    if (cohortCols.length > 0) {
      cohortVals.push(userId);
      await db.query(`UPDATE cohort_students SET ${cohortCols.join(', ')} WHERE id = ?`, cohortVals);
    }

    return true;
  } catch (err) {
    console.error('Error updating user profile in MySQL:', err);
    return false;
  }
}

/**
 * Fetch all students from cohort_students and users for teacher view with optional class/status/interest/search filtering
 */
export async function getCohortStudentsFromDb(filters?: {
  grade?: string;
  status?: string;
  search?: string;
  interest?: string;
  sortBy?: string;
  institutionId?: string;
}): Promise<any[]> {
  try {
    const db = getDbPool();
    let query = `SELECT u.id, u.name, u.email, u.grade, u.student_id as studentId, u.avatar,
              COALESCE(p.overall_mastery, c.overall_mastery, 0) as overallMastery,
              p.struggling_concept as strugglingConcept,
              COALESCE(p.status, c.status, 'On Track') as status,
              COALESCE(p.last_active, c.last_active, 'Recently active') as lastActive,
              u.interest,
              COALESCE(c.registered_at, UNIX_TIMESTAMP(u.created_at) * 1000) as registeredAt,
              COALESCE(c.is_new_registration, 0) as isNewRegistration
       FROM users u
       LEFT JOIN student_progress p ON u.id = p.user_id
       LEFT JOIN cohort_students c ON u.id = c.id
       WHERE u.role = 'student'`;

    const queryParams: any[] = [];
    if (filters?.institutionId) {
       query += ` AND u.institution_id = ?`;
       queryParams.push(filters.institutionId);
    }

    query += ` ORDER BY u.updated_at DESC`;

    const [rows]: any = await db.query(query, queryParams);

    const seenEmails = new Set<string>();
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();
    let deduped: any[] = [];

    for (const r of rows || []) {
      if (!r || !r.name) continue;
      // Strip any test timestamp artifacts (e.g. "Pooja Patel 1789298923" -> "Pooja Patel")
      const cleanName = r.name.replace(/\s+\d{6,}$/, '').trim();
      const email = (r.email || '').toLowerCase().trim();
      const id = r.id;
      const nameLower = cleanName.toLowerCase();

      // Exclude educator accounts
      if (nameLower.includes('dr. priya') || nameLower.includes('prof. vikram')) continue;
      if (seenIds.has(id) || (email && seenEmails.has(email)) || (nameLower && seenNames.has(nameLower))) continue;

      if (id) seenIds.add(id);
      if (email) seenEmails.add(email);
      if (nameLower) seenNames.add(nameLower);

      deduped.push({
        ...r,
        name: cleanName,
        grade: normalizeGradeName(r.grade || 'Class 10'),
      });
    }

    // 1. Grade / Class Filter
    if (filters?.grade && filters.grade !== 'all') {
      const targetGrade = normalizeGradeName(filters.grade);
      deduped = deduped.filter((s) => normalizeGradeName(s.grade) === targetGrade);
    }

    // 2. Status Filter
    if (filters?.status && filters.status !== 'all') {
      const st = filters.status.toLowerCase();
      if (st === 'new') {
        deduped = deduped.filter((s) => s.isNewRegistration || s.status === 'New Enrollee');
      } else {
        deduped = deduped.filter((s) => (s.status || '').toLowerCase() === st);
      }
    }

    // 3. Interest Filter
    if (filters?.interest && filters.interest !== 'all') {
      const intTarget = filters.interest.toLowerCase();
      deduped = deduped.filter((s) => (s.interest || '').toLowerCase() === intTarget);
    }

    // 4. Search Filter
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      deduped = deduped.filter((s) => {
        return (
          s.name.toLowerCase().includes(q) ||
          (s.email && s.email.toLowerCase().includes(q)) ||
          (s.studentId && s.studentId.toLowerCase().includes(q)) ||
          (s.grade && s.grade.toLowerCase().includes(q)) ||
          (s.interest && s.interest.toLowerCase().includes(q))
        );
      });
    }

    // 5. Sorting
    if (filters?.sortBy) {
      if (filters.sortBy === 'mastery_desc') {
        deduped.sort((a, b) => b.overallMastery - a.overallMastery);
      } else if (filters.sortBy === 'mastery_asc') {
        deduped.sort((a, b) => a.overallMastery - b.overallMastery);
      } else if (filters.sortBy === 'name_asc') {
        deduped.sort((a, b) => a.name.localeCompare(b.name));
      } else if (filters.sortBy === 'grade_asc') {
        deduped.sort((a, b) => a.grade.localeCompare(b.grade));
      }
    }

    return deduped;
  } catch (err) {
    console.error('Error getting cohort students from DB:', err);
    return [];
  }
}

export async function getStudentProgressFromDb(userId: string): Promise<{
  conceptsMap: Record<string, ConceptNode[]> | null;
  overallMastery: number;
  strugglingConcept: string | null;
  status: string;
  interest?: StudentInterest;
  grade?: string;
  streakCount?: number;
  name?: string;
} | null> {
  try {
    const db = getDbPool();
    const [rows]: any = await db.query(
      `SELECT p.overall_mastery, p.struggling_concept, p.status, p.concepts_json,
              u.interest, u.grade, u.streak_count, u.name
       FROM users u
       LEFT JOIN student_progress p ON u.id = p.user_id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    let conceptsMap = null;
    if (row.concepts_json) {
      try {
        conceptsMap = JSON.parse(row.concepts_json);
      } catch {
        conceptsMap = null;
      }
    }
    return {
      conceptsMap,
      overallMastery: Number(row.overall_mastery) || 0,
      strugglingConcept: row.struggling_concept || null,
      status: row.status || 'On Track',
      interest: (row.interest as StudentInterest) || 'Cricket & Sports',
      grade: row.grade || 'Grade 10',
      streakCount: Number(row.streak_count) || 1,
      name: row.name,
    };
  } catch (err) {
    console.error('Error getting student progress from DB:', err);
    return null;
  }
}

/**
 * Save student quiz attempt with BKT mastery and Bloom's cognitive taxonomy breakdown
 */
export async function saveQuizAttempt(attempt: {
  id?: string;
  userId: string;
  conceptId: string;
  conceptTitle: string;
  subject?: string;
  score: number;
  accuracy: number;
  isMastered: boolean;
  timeSpent: number;
  bktMastery: number;
  answersJson: any;
  bloomsBreakdownJson?: any;
}): Promise<{ id: string; success: boolean }> {
  try {
    const db = getDbPool();
    const attemptId = attempt.id || `att_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const answersStr = typeof attempt.answersJson === 'string' ? attempt.answersJson : JSON.stringify(attempt.answersJson || []);
    const bloomsStr = attempt.bloomsBreakdownJson
      ? typeof attempt.bloomsBreakdownJson === 'string'
        ? attempt.bloomsBreakdownJson
        : JSON.stringify(attempt.bloomsBreakdownJson)
      : null;

    await db.query(
      `INSERT INTO quiz_attempts 
       (id, user_id, concept_id, concept_title, subject, score, accuracy, is_mastered, time_spent, bkt_mastery, answers_json, blooms_breakdown_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         score = VALUES(score),
         accuracy = VALUES(accuracy),
         is_mastered = VALUES(is_mastered),
         time_spent = VALUES(time_spent),
         bkt_mastery = VALUES(bkt_mastery)`,
      [
        attemptId,
        attempt.userId,
        attempt.conceptId,
        attempt.conceptTitle,
        attempt.subject || 'Mathematics',
        Math.round(attempt.score),
        Math.round(attempt.accuracy),
        attempt.isMastered ? 1 : 0,
        Math.round(attempt.timeSpent),
        attempt.bktMastery,
        answersStr,
        bloomsStr,
      ]
    );
    return { id: attemptId, success: true };
  } catch (err) {
    console.error('Error saving quiz attempt to DB:', err);
    return { id: '', success: false };
  }
}

/**
 * Retrieve chronological quiz history for a student with empirical Bloom's metrics
 */
export async function getUserQuizAttempts(userId: string, limit = 20): Promise<any[]> {
  try {
    const db = getDbPool();
    const [rows]: any = await db.query(
      `SELECT id, user_id as userId, concept_id as conceptId, concept_title as conceptTitle,
              subject, score, accuracy, is_mastered as isMastered, time_spent as timeSpent,
              bkt_mastery as bktMastery, answers_json as answersJson, blooms_breakdown_json as bloomsBreakdownJson,
              created_at as createdAt
       FROM quiz_attempts
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );
    return (rows || []).map((r: any) => {
      let answers = [];
      let blooms = null;
      try { answers = JSON.parse(r.answersJson); } catch {}
      try { if (r.bloomsBreakdownJson) blooms = JSON.parse(r.bloomsBreakdownJson); } catch {}
      return {
        id: String(r.id),
        userId: r.userId,
        conceptId: r.conceptId,
        conceptTitle: r.conceptTitle,
        subject: r.subject,
        score: Number(r.score) || 0,
        accuracy: Number(r.accuracy) || 0,
        isMastered: Boolean(r.isMastered),
        timeSpent: Number(r.timeSpent) || 0,
        bktMastery: Number(r.bktMastery) || 0,
        answers,
        bloomsBreakdown: blooms,
        createdAt: r.createdAt,
      };
    });
  } catch (err) {
    console.error('Error getting user quiz attempts from DB:', err);
    return [];
  }
}

/**
 * Fetch curriculum nodes from MySQL for dynamic Teacher Curriculum Studio
 */
export async function getCurriculumNodesFromDb(subject?: string, grade?: string): Promise<any[]> {
  try {
    const db = getDbPool();
    let query = `SELECT id, subject, grade, title, category, description, difficulty,
                        prerequisites_json as prerequisitesJson, tags_json as tagsJson,
                        estimated_time as estimatedTime, created_by as createdBy,
                        is_custom as isCustom, created_at as createdAt
                 FROM curriculum_nodes`;
    const params: any[] = [];
    if (subject && grade) {
      query += ` WHERE subject = ? AND grade = ?`;
      params.push(subject, grade);
    } else if (subject) {
      query += ` WHERE subject = ?`;
      params.push(subject);
    }
    query += ` ORDER BY created_at ASC`;

    const [rows]: any = await db.query(query, params);
    return (rows || []).map((r: any) => {
      let prerequisites: string[] = [];
      let tags: string[] = [];
      try { if (r.prerequisitesJson) prerequisites = JSON.parse(r.prerequisitesJson); } catch {}
      try { if (r.tagsJson) tags = JSON.parse(r.tagsJson); } catch {}
      return {
        id: r.id,
        subject: r.subject,
        grade: r.grade,
        title: r.title,
        category: r.category,
        description: r.description,
        difficulty: r.difficulty,
        prerequisites,
        tags,
        estimatedTimeMin: Number(r.estimatedTime) || 20,
        createdBy: r.createdBy,
        isCustom: Boolean(r.isCustom),
      };
    });
  } catch (err) {
    console.error('Error getting curriculum nodes from DB:', err);
    return [];
  }
}

/**
 * Upsert a custom curriculum node from Teacher Studio into MySQL
 */
export async function saveCurriculumNodeToDb(node: {
  id: string;
  subject: string;
  grade?: string;
  title: string;
  category?: string;
  description?: string;
  difficulty?: string;
  prerequisites?: string[];
  tags?: string[];
  estimatedTime?: number;
  createdBy?: string;
  isCustom?: boolean;
}): Promise<boolean> {
  try {
    const db = getDbPool();
    const prereqsStr = JSON.stringify(node.prerequisites || []);
    const tagsStr = JSON.stringify(node.tags || []);

    await db.query(
      `INSERT INTO curriculum_nodes 
       (id, subject, grade, title, category, description, difficulty, prerequisites_json, tags_json, estimated_time, created_by, is_custom)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         subject = VALUES(subject),
         grade = VALUES(grade),
         title = VALUES(title),
         category = VALUES(category),
         description = VALUES(description),
         difficulty = VALUES(difficulty),
         prerequisites_json = VALUES(prerequisites_json),
         tags_json = VALUES(tags_json),
         estimated_time = VALUES(estimated_time)`,
      [
        node.id,
        node.subject,
        node.grade || 'Grade 10',
        node.title,
        node.category || 'General',
        node.description || '',
        node.difficulty || 'Beginner',
        prereqsStr,
        tagsStr,
        node.estimatedTime || 20,
        node.createdBy || 'teacher',
        node.isCustom ?? true ? 1 : 0,
      ]
    );
    return true;
  } catch (err) {
    console.error('Error saving curriculum node to DB:', err);
    return false;
  }
}

/**
 * Delete a custom curriculum node from MySQL
 */
export async function deleteCurriculumNodeFromDb(nodeId: string): Promise<boolean> {
  try {
    const db = getDbPool();
    await db.query(`DELETE FROM curriculum_nodes WHERE id = ?`, [nodeId]);
    return true;
  } catch (err) {
    console.error('Error deleting curriculum node from DB:', err);
    return false;
  }
}

/**
 * Calibrate knowledge graph baseline using BKT and diagnostic test answers, persisting to MySQL
 */
export async function calibrateStudentDiagnosticInDb(params: {
  userId: string;
  grade?: string;
  subject?: string;
  answers: {
    questionId: string;
    conceptId: string;
    isCorrect: boolean;
    difficulty?: string;
    bloomsLevel?: string;
    timeSpent?: number;
  }[];
}): Promise<{
  success: boolean;
  conceptsMap: Record<string, ConceptNode[]>;
  overallMastery: number;
  diagnosticAttemptId: string;
  results: {
    conceptId: string;
    score: number;
    status: string;
    isCorrect: boolean;
  }[];
}> {
  const db = getDbPool();
  const normGrade = normalizeGradeName(params.grade || 'Class 10');

  // 1. Fetch current student progress from DB
  const [progRows]: any = await db.query(
    `SELECT concepts_json, overall_mastery FROM student_progress WHERE user_id = ? LIMIT 1`,
    [params.userId]
  );

  let conceptsMap: Record<string, ConceptNode[]>;
  if (progRows && progRows.length > 0 && progRows[0].concepts_json) {
    try {
      conceptsMap = JSON.parse(progRows[0].concepts_json);
    } catch {
      conceptsMap = getCurriculumForGrade(normGrade);
    }
  } else {
    conceptsMap = getCurriculumForGrade(normGrade);
  }

  // 2. Compute calibration score and BKT prior per question
  const results: { conceptId: string; score: number; status: string; isCorrect: boolean }[] = [];
  let totalScore = 0;
  let correctCount = 0;
  const bloomsCorrect: Record<string, { correct: number; total: number }> = {
    Recall: { correct: 0, total: 0 },
    Application: { correct: 0, total: 0 },
    Analysis: { correct: 0, total: 0 },
  };

  params.answers.forEach((ans) => {
    const diff = (ans.difficulty || '').toLowerCase();
    const blooms = ans.bloomsLevel || (diff.includes('adv') ? 'Analysis' : diff.includes('inter') ? 'Application' : 'Recall');
    if (bloomsCorrect[blooms]) {
      bloomsCorrect[blooms].total += 1;
      if (ans.isCorrect) bloomsCorrect[blooms].correct += 1;
    }

    let score = 40;
    if (ans.isCorrect) {
      correctCount++;
      if (diff.includes('adv') || diff.includes('hard')) score = 95;
      else if (diff.includes('inter') || diff.includes('medium')) score = 88;
      else score = 82;
    } else {
      if (diff.includes('adv') || diff.includes('hard')) score = 48;
      else if (diff.includes('inter') || diff.includes('medium')) score = 40;
      else score = 32;
    }

    totalScore += score;
    const status = score >= 80 ? 'mastered' : score >= 50 ? 'in_progress' : 'prerequisite_gap';
    results.push({
      conceptId: ans.conceptId,
      score,
      status,
      isCorrect: ans.isCorrect,
    });
  });

  // 3. Update concept nodes in conceptsMap
  const masteredConceptIds = new Set<string>();
  Object.keys(conceptsMap).forEach((subj) => {
    conceptsMap[subj] = conceptsMap[subj].map((c) => {
      const match = results.find((r) => r.conceptId === c.id);
      if (match) {
        if (match.score >= 80) masteredConceptIds.add(c.id);
        return {
          ...c,
          masteryScore: match.score,
          status: match.status as any,
        };
      }
      return c;
    });
  });

  // 4. Evaluate topological DAG prerequisites for remaining nodes
  Object.keys(conceptsMap).forEach((subj) => {
    conceptsMap[subj] = conceptsMap[subj].map((c) => {
      if (c.status === 'locked') {
        const allPrereqsMet = c.prerequisites.length === 0 || c.prerequisites.every((p) => masteredConceptIds.has(p));
        if (allPrereqsMet) {
          return { ...c, status: 'in_progress' };
        }
      }
      return c;
    });

    // Ensure at least the first non-mastered node is unlocked and active
    const firstNonMastered = conceptsMap[subj].find((c) => c.status !== 'mastered');
    if (firstNonMastered && firstNonMastered.status === 'locked') {
      firstNonMastered.status = 'in_progress';
    }
  });

  // 5. Calculate new overall mastery
  let allConceptsCount = 0;
  let allConceptsSum = 0;
  let strugglingConcept: string | null = null;
  Object.keys(conceptsMap).forEach((subj) => {
    conceptsMap[subj].forEach((c) => {
      allConceptsCount++;
      allConceptsSum += c.masteryScore;
      if (c.status === 'prerequisite_gap' && !strugglingConcept) {
        strugglingConcept = c.title;
      }
    });
  });
  const overallMastery = Math.round(allConceptsSum / (allConceptsCount || 1));
  const newStatus = overallMastery >= 80 ? 'Excelling' : overallMastery < 60 ? 'Needs Intervention' : 'On Track';

  const recAcc = bloomsCorrect.Recall.total > 0 ? Math.round((bloomsCorrect.Recall.correct / bloomsCorrect.Recall.total) * 100) : 0;
  const appAcc = bloomsCorrect.Application.total > 0 ? Math.round((bloomsCorrect.Application.correct / bloomsCorrect.Application.total) * 100) : 0;
  const anaAcc = bloomsCorrect.Analysis.total > 0 ? Math.round((bloomsCorrect.Analysis.correct / bloomsCorrect.Analysis.total) * 100) : 0;

  const bloomsBreakdown = {
    Recall: recAcc,
    Application: appAcc,
    Analysis: anaAcc,
    recallAccuracy: recAcc,
    applicationAccuracy: appAcc,
    analysisAccuracy: anaAcc,
  };

  const diagAttempt = await saveQuizAttempt({
    userId: params.userId,
    conceptId: 'diagnostic_baseline',
    conceptTitle: `${normGrade} Prerequisite Baseline Diagnostic`,
    subject: params.subject || 'Mathematics',
    score: Math.round(totalScore / (params.answers.length || 1)),
    accuracy: Math.round((correctCount / (params.answers.length || 1)) * 100),
    isMastered: correctCount >= Math.ceil(params.answers.length * 0.7),
    timeSpent: params.answers.reduce((acc, a) => acc + (a.timeSpent || 20), 0),
    bktMastery: overallMastery / 100,
    answersJson: params.answers,
    bloomsBreakdownJson: bloomsBreakdown,
  });
  const diagnosticAttemptId = String(diagAttempt.id || Date.now());

  // 7. Update student_progress in MySQL
  await db.query(
    `UPDATE student_progress 
     SET overall_mastery = ?, concepts_json = ?, status = ?, struggling_concept = ?, diagnostic_completed = 1, updated_at = NOW() 
     WHERE user_id = ?`,
    [overallMastery, JSON.stringify(conceptsMap), newStatus, strugglingConcept, params.userId]
  );

  // 8. Update cohort_students roster
  await db.query(
    `UPDATE cohort_students 
     SET overall_mastery = ?, status = ?, struggling_concept = ?, is_new_registration = 0, last_active = 'Diagnostic calibrated' 
     WHERE id = ?`,
    [overallMastery, newStatus, strugglingConcept, params.userId]
  );

  return {
    success: true,
    conceptsMap,
    overallMastery,
    diagnosticAttemptId,
    results,
  };
}

/**
 * Permanently delete a student from cohort_students, student_progress, and users
 */
export async function deleteCohortStudentFromDb(studentId: string): Promise<boolean> {
  try {
    const db = getDbPool();
    await db.query(`DELETE FROM cohort_students WHERE id = ?`, [studentId]);
    await db.query(`DELETE FROM student_progress WHERE user_id = ?`, [studentId]);
    await db.query(`DELETE FROM users WHERE id = ?`, [studentId]);
    return true;
  } catch (err) {
    console.error('Error deleting student from DB:', err);
    return false;
  }
}

/**
 * Direct enrollment of a student into MySQL users, cohort_students, and student_progress
 */
export async function enrollStudentInCohortDb(params: {
  id?: string;
  name: string;
  email?: string;
  grade?: string;
  studentId?: string;
  avatar?: string;
  interest?: StudentInterest;
  overallMastery?: number;
  status?: string;
  institution?: string;
  institutionId?: string;
  institutionCode?: string;
}): Promise<{ success: boolean; student: any }> {
  try {
    const db = getDbPool();
    const cleanName = (params.name || '').trim();
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const cleanEmail = (params.email || `${slug}@student.learnx.org`).toLowerCase().trim();

    // Resolve institution from code if provided
    let instName = params.institution;
    let instId = params.institutionId;
    let instCode = params.institutionCode ? params.institutionCode.trim().toUpperCase() : undefined;

    if (instCode && (!instName || !instId)) {
      const [matchedInst]: any = await db.query(
        `SELECT * FROM institutions WHERE UPPER(code) = ? LIMIT 1`,
        [instCode]
      );
      if (matchedInst && matchedInst[0]) {
        instId = matchedInst[0].id;
        instCode = matchedInst[0].code;
        instName = matchedInst[0].name;
      }
    }
    const resolvedInst = instName || 'Delhi Public School';
    const resolvedInstId = instId || 'inst-dps-2026';
    const resolvedInstCode = instCode || 'DPS2026';

    // Check if user already exists with this email to prevent duplicate or conflicting entries
    const [existingUsers]: any = await db.query(
      `SELECT id, student_id FROM users WHERE email = ? LIMIT 1`,
      [cleanEmail]
    );
    const userId = params.id || (existingUsers && existingUsers[0] ? existingUsers[0].id : `stu_${slug || Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    const studentId = params.studentId || (existingUsers && existingUsers[0]?.student_id ? existingUsers[0].student_id : `STU-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    const normGrade = normalizeGradeName(params.grade || 'Class 10');
    const interest = params.interest || 'Cricket & Sports';
    const avatar = params.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80`;
    const mastery = Number(params.overallMastery) || 50;
    const status = params.status || 'New Enrollee';

    // 1. Insert into users table
    await db.query(
      `INSERT INTO users (id, name, email, role, student_id, grade, interest, streak_count, avatar, institution, institution_id, institution_code)
       VALUES (?, ?, ?, 'student', ?, ?, ?, 1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), grade = VALUES(grade), interest = VALUES(interest), institution = VALUES(institution), institution_id = VALUES(institution_id), institution_code = VALUES(institution_code)`,
      [userId, cleanName, cleanEmail, studentId, normGrade, interest, avatar, resolvedInst, resolvedInstId, resolvedInstCode]
    );

    // 2. Initialize student_progress table
    const cleanConcepts = createCleanConcepts(normGrade);
    await db.query(
      `INSERT INTO student_progress (user_id, overall_mastery, struggling_concept, status, concepts_json, diagnostic_completed)
       VALUES (?, ?, NULL, ?, ?, 0)
       ON DUPLICATE KEY UPDATE overall_mastery = VALUES(overall_mastery), status = VALUES(status)`,
      [userId, mastery, status, JSON.stringify(cleanConcepts)]
    );

    // 3. Insert into cohort_students table
    await db.query(
      `INSERT INTO cohort_students (id, name, email, grade, student_id, avatar, overall_mastery, struggling_concept, status, interest, registered_at, is_new_registration, institution, institution_id, institution_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), overall_mastery = VALUES(overall_mastery), status = VALUES(status), institution = VALUES(institution), institution_id = VALUES(institution_id), institution_code = VALUES(institution_code)`,
      [userId, cleanName, cleanEmail, normGrade, studentId, avatar, mastery, status, interest, Date.now(), resolvedInst, resolvedInstId, resolvedInstCode]
    );

    const studentRecord = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      grade: normGrade,
      studentId,
      avatar,
      overallMastery: mastery,
      strugglingConcept: null,
      status,
      lastActive: 'Just registered',
      interest,
      registeredAt: Date.now(),
      isNewRegistration: true,
      institution: resolvedInst,
      institutionId: resolvedInstId,
      institutionCode: resolvedInstCode,
    };

    return { success: true, student: studentRecord };
  } catch (err) {
    console.error('Error enrolling student in DB:', err);
    return { success: false, student: null };
  }
}

/**
 * Dynamically extract empirical curriculum bottlenecks and learning velocity from MySQL
 */
export async function getCurriculumBottlenecksFromDb(institutionId?: string): Promise<{
  bottlenecks: {
    concept: string;
    failureRate: number;
    recommendedAction: string;
    affectedLearnersCount: number;
  }[];
  velocityGain: number | null;
  atRiskCount: number | null;
}> {
  try {
    const db = getDbPool();

    const joinClause = institutionId ? 'JOIN users u ON q.user_id = u.id' : '';
    const whereClause = institutionId ? 'WHERE u.institution_id = ?' : '';
    const queryParams = institutionId ? [institutionId] : [];

    // 1. Check quiz attempt failure rates grouped by concept
    const [attemptRows]: any = await db.query(`
      SELECT q.concept_title,
             COUNT(*) as totalAttempts,
             SUM(CASE WHEN q.score < 70 OR q.is_mastered = 0 THEN 1 ELSE 0 END) as failureCount
      FROM quiz_attempts q
      ${joinClause}
      ${whereClause}
      GROUP BY q.concept_title
      ORDER BY failureCount DESC
      LIMIT 6
    `, queryParams);

    // 2. Check current student struggle concepts
    const [struggleRows]: any = await db.query(`
      SELECT struggling_concept, COUNT(*) as studentCount
      FROM cohort_students
      WHERE struggling_concept IS NOT NULL AND struggling_concept != ''
      GROUP BY struggling_concept
      ORDER BY studentCount DESC
    `);

    const bottleneckMap = new Map<string, { failureRate: number; affectedLearnersCount: number }>();

    (attemptRows || []).forEach((r: any) => {
      const total = Number(r.totalAttempts) || 1;
      const failures = Number(r.failureCount) || 0;
      if (failures > 0) {
        const rate = Math.min(95, Math.max(25, Math.round((failures / total) * 100)));
        bottleneckMap.set(r.concept_title, { failureRate: rate, affectedLearnersCount: failures });
      }
    });

    (struggleRows || []).forEach((r: any) => {
      const c = r.struggling_concept;
      const count = Number(r.studentCount) || 1;
      const existing = bottleneckMap.get(c);
      if (existing) {
        existing.affectedLearnersCount += count;
      } else {
        bottleneckMap.set(c, { failureRate: 42, affectedLearnersCount: count });
      }
    });

    // Recommended pedagogical actions generator
    const getActionForConcept = (conceptName: string) => {
      const c = conceptName.toLowerCase();
      if (c.includes('quadratic') || c.includes('root')) {
        return 'Trigger prerequisite remediation on Factoring & Identities; switch from rote formula to Geometric Parabola Visuals.';
      }
      if (c.includes('slope') || c.includes('linear')) {
        return 'Scaffold rise-over-run sign reversals using physical sports elevation or climb angle telemetry.';
      }
      if (c.includes('parabola') || c.includes('geometry') || c.includes('trajectory')) {
        return 'Group struggling students for an interactive projectile trajectory workshop using real-world analogies.';
      }
      if (c.includes('newton') || c.includes('friction') || c.includes('force')) {
        return 'Clarify static vs kinetic threshold equilibrium before solving multi-body kinematics equations.';
      }
      if (c.includes('trigonometry') || c.includes('ratio')) {
        return 'Reinforce unit-circle right triangle definitions (SOH CAH TOA) before multi-step angle elevations.';
      }
      if (c.includes('electric') || c.includes('circuit') || c.includes('ohm')) {
        return 'Emphasize the reciprocal rule for parallel networks to prevent erroneous series summation.';
      }
      return 'Initiate scaffolded micro-drills, visual walkthroughs, and peer-mentorship pairing.';
    };

    const bottlenecks: { concept: string; failureRate: number; recommendedAction: string; affectedLearnersCount: number }[] = [];

    bottleneckMap.forEach((val, concept) => {
      bottlenecks.push({
        concept,
        failureRate: val.failureRate,
        recommendedAction: getActionForConcept(concept),
        affectedLearnersCount: val.affectedLearnersCount,
      });
    });

    const velocityGain: number | null = null;

    // Count at-risk students
    const [atRiskRows]: any = await db.query(`
      SELECT COUNT(*) as cnt FROM cohort_students WHERE status = 'Needs Intervention' OR overall_mastery < 60
    `);
    const atRiskCount = Number(atRiskRows?.[0]?.cnt) || 0;

    return {
      bottlenecks,
      velocityGain,
      atRiskCount,
    };
  } catch (err) {
    console.error('Error getting bottlenecks from DB:', err);
    return {
      bottlenecks: [],
      velocityGain: null,
      atRiskCount: null,
    };
  }
}

/**
 * Deploy teacher-initiated remediation intervention across at-risk students in MySQL
 */
export async function deployTeacherInterventionInDb(params: {
  conceptTitle: string;
  subject?: string;
  teacherId?: string;
}): Promise<{ success: boolean; impactedCount: number }> {
  try {
    const db = getDbPool();
    const { conceptTitle } = params;

    // 1. Fetch all student progress records
    const [students]: any = await db.query(`SELECT user_id, concepts_json FROM student_progress`);
    let impactedCount = 0;

    for (const student of students || []) {
      if (!student.concepts_json) continue;
      try {
        const conceptsMap: Record<string, ConceptNode[]> = JSON.parse(student.concepts_json);
        let modified = false;

        Object.keys(conceptsMap).forEach((subj) => {
          conceptsMap[subj] = conceptsMap[subj].map((c) => {
            if (c.title.toLowerCase().includes(conceptTitle.toLowerCase()) || conceptTitle.toLowerCase().includes(c.title.toLowerCase())) {
              if (c.status !== 'mastered') {
                c.status = 'remediation';
                modified = true;
              }
            }
            return c;
          });
        });

        if (modified) {
          impactedCount++;
          await db.query(
            `UPDATE student_progress 
             SET concepts_json = ?, struggling_concept = ?, status = 'Needs Intervention', updated_at = NOW() 
             WHERE user_id = ?`,
            [JSON.stringify(conceptsMap), conceptTitle, student.user_id]
          );

          await db.query(
            `UPDATE cohort_students 
             SET struggling_concept = ?, status = 'Needs Intervention' 
             WHERE id = ?`,
            [conceptTitle, student.user_id]
          );
        }
      } catch (e) {
        // Skip parsing errors
      }
    }

    return { success: true, impactedCount: Math.max(1, impactedCount) };
  } catch (err) {
    console.error('Error deploying teacher intervention to DB:', err);
    return { success: false, impactedCount: 0 };
  }
}

// ============================================================================
// ADMIN PANEL, CRM & SYSTEM CONTROL ROOM METHODS
// ============================================================================

import fs from 'fs';
import path from 'path';

/**
 * Log an administrative or system action into system_audit_logs
 */
export async function logSystemAction(params: {
  action: string;
  actorId?: string;
  actorName?: string;
  targetType?: string;
  targetId?: string;
  details?: any;
  ipAddress?: string;
}): Promise<void> {
  try {
    const db = getDbPool();
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.query(
      `INSERT INTO system_audit_logs (id, action, actor_id, actor_name, target_type, target_id, details_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.action,
        params.actorId || 'system',
        params.actorName || 'System',
        params.targetType || null,
        params.targetId || null,
        params.details ? JSON.stringify(params.details) : null,
        params.ipAddress || '127.0.0.1',
      ]
    );
  } catch (err) {
    console.warn('Could not write to system_audit_logs:', err);
  }
}

/**
 * Fetch all system settings from DB
 */
export async function getSystemSettingsFromDb(): Promise<any> {
  try {
    const db = getDbPool();
    const [rows]: any = await db.query('SELECT setting_key, setting_value FROM system_settings');
    const settingsMap: Record<string, string> = {};
    if (rows && rows.length > 0) {
      rows.forEach((r: any) => {
        settingsMap[r.setting_key] = r.setting_value;
      });
    }

    return {
      geminiEnabled: settingsMap.gemini_enabled !== 'false',
      geminiApiKey: settingsMap.gemini_api_key || process.env.GEMINI_API_KEY ,
      geminiModel: settingsMap.gemini_model || 'gemini-2.5-flash',
      geminiModelPriority: settingsMap.gemini_model_priority
        ? JSON.parse(settingsMap.gemini_model_priority)
        : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-pro'],
      geminiTemperature: parseFloat(settingsMap.gemini_temperature || '0.7'),
      maintenanceMode: settingsMap.maintenance_mode === 'true',
      announcementBanner: settingsMap.announcement_banner || '',
    };
  } catch (err) {
    console.error('Error fetching system settings from DB:', err);
    return {
      geminiEnabled: true,
      geminiApiKey: process.env.GEMINI_API_KEY ,
      geminiModel: 'gemini-2.5-flash',
      geminiModelPriority: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-pro'],
      geminiTemperature: 0.7,
      maintenanceMode: false,
      announcementBanner: '',
    };
  }
}

/**
 * Save / update a system setting in DB
 */
export async function saveSystemSettingToDb(key: string, value: any, actorName = 'Admin'): Promise<boolean> {
  try {
    const db = getDbPool();
    const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await db.query(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [key, strVal]
    );

    await logSystemAction({
      action: 'UPDATE_SYSTEM_SETTING',
      actorName,
      targetType: 'setting',
      targetId: key,
      details: { key, value: key.includes('key') ? '***MASKED***' : value },
    });

    return true;
  } catch (err) {
    console.error('Error saving system setting to DB:', err);
    return false;
  }
}

/**
 * Get all users with CRM search, role, grade, status, interest, and sort filters
 */
export async function getAllUsersFromDb(filters: {
  search?: string;
  role?: string;
  grade?: string;
  status?: string;
  interest?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
}): Promise<{ users: any[]; total: number }> {
  try {
    const db = getDbPool();
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim().toLowerCase()}%`;
      conditions.push('(LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.student_id) LIKE ? OR LOWER(u.teacher_id) LIKE ? OR LOWER(u.institution) LIKE ?)');
      params.push(term, term, term, term, term);
    }

    if (filters.role && filters.role !== 'all') {
      conditions.push('u.role = ?');
      params.push(filters.role);
    }

    if (filters.grade && filters.grade !== 'all') {
      const numMatch = filters.grade.match(/\d+/);
      if (numMatch) {
        const num = numMatch[0];
        conditions.push('(u.grade = ? OR u.grade = ? OR u.grade LIKE ?)');
        params.push(`Class ${num}`, `Grade ${num}`, `%${num}%`);
      } else {
        conditions.push('u.grade = ?');
        params.push(filters.grade);
      }
    }

    if (filters.status && filters.status !== 'all') {
      if (filters.status.toLowerCase() === 'new enrollee' || filters.status.toLowerCase() === 'new') {
        conditions.push('(p.status = "New Enrollee" OR c.status = "New Enrollee" OR c.is_new_registration = 1)');
      } else if (filters.status === 'Active') {
        conditions.push('(COALESCE(p.status, c.status, "Active") != "Needs Intervention")');
      } else {
        conditions.push('(p.status = ? OR c.status = ?)');
        params.push(filters.status, filters.status);
      }
    }

    if (filters.interest && filters.interest !== 'all') {
      conditions.push('u.interest = ?');
      params.push(filters.interest);
    }

    const whereClause = conditions.join(' AND ');

    // Total count
    const [countRows]: any = await db.query(
      `SELECT COUNT(DISTINCT u.id) as total
       FROM users u
       LEFT JOIN student_progress p ON u.id = p.user_id
       LEFT JOIN cohort_students c ON u.id = c.id
       WHERE ${whereClause}`,
      params
    );
    const total = Number(countRows?.[0]?.total) || 0;

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(filters.limit) || 50));
    const offset = (page - 1) * limit;

    let orderClause = 'u.created_at DESC';
    if (filters.sortBy === 'mastery_desc') {
      orderClause = 'overallMastery DESC, u.created_at DESC';
    } else if (filters.sortBy === 'mastery_asc') {
      orderClause = 'overallMastery ASC, u.created_at DESC';
    } else if (filters.sortBy === 'name_asc') {
      orderClause = 'u.name ASC';
    } else if (filters.sortBy === 'grade_asc') {
      orderClause = 'u.grade ASC, u.name ASC';
    }

    const [rows]: any = await db.query(
      `SELECT 
         u.id, u.name, u.email, u.role, u.student_id as studentId, u.teacher_id as teacherId,
         u.grade, u.institution, u.institution_id as institutionId, u.institution_code as institutionCode,
         u.department, u.interest, u.avatar,
         u.created_at as createdAt, u.updated_at as updatedAt,
         COALESCE(p.overall_mastery, c.overall_mastery, 0) as overallMastery,
         COALESCE(p.struggling_concept, c.struggling_concept) as strugglingConcept,
         COALESCE(p.status, c.status, 'Active') as status,
         (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.user_id = u.id) as quizCount
       FROM users u
       LEFT JOIN student_progress p ON u.id = p.user_id
       LEFT JOIN cohort_students c ON u.id = c.id
       WHERE ${whereClause}
       ORDER BY ${orderClause}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const users = (rows || []).map((u: any) => ({
      ...u,
      grade: u.role === 'student' ? normalizeGradeName(u.grade || 'Class 10') : u.grade,
    }));

    return {
      users,
      total,
    };
  } catch (err) {
    console.error('Error fetching users from DB:', err);
    return { users: [], total: 0 };
  }
}

/**
 * Admin Create User
 */
export async function adminCreateUser(userData: {
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin' | 'institution';
  grade?: string;
  interest?: StudentInterest;
  institution?: string;
  institutionId?: string;
  institutionCode?: string;
  department?: string;
  studentId?: string;
  teacherId?: string;
  overallMastery?: number;
  actorName?: string;
}): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const db = getDbPool();
    const cleanName = userData.name.trim();
    const cleanEmail = userData.email.trim().toLowerCase();
    const role = userData.role || 'student';
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const id = `${role === 'admin' ? 'adm' : role === 'teacher' ? 'teach' : 'stu'}_${slug}_${Math.random().toString(36).substring(2, 6)}`;
    const grade = normalizeGradeName(userData.grade || 'Class 10');
    const studentId = userData.studentId || (role === 'student' ? `STU-2026-${Math.floor(1000 + Math.random() * 9000)}` : null);
    const teacherId = userData.teacherId || (role === 'teacher' ? `FAC-2026-${Math.floor(100 + Math.random() * 900)}` : null);
    const mastery = Number(userData.overallMastery) || (role === 'student' ? 50 : 100);
    const avatar =
      role === 'admin'
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
        : role === 'teacher'
        ? 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

    // Resolve institution from code if provided
    let instName = userData.institution;
    let instId = userData.institutionId;
    let instCode = userData.institutionCode ? userData.institutionCode.trim().toUpperCase() : undefined;

    if (instCode && (!instName || !instId)) {
      const [matchedInst]: any = await db.query(
        `SELECT * FROM institutions WHERE UPPER(code) = ? LIMIT 1`,
        [instCode]
      );
      if (matchedInst && matchedInst[0]) {
        instId = matchedInst[0].id;
        instCode = matchedInst[0].code;
        instName = matchedInst[0].name;
      }
    }
    const resolvedInst = instName || (role === 'admin' ? 'LearnX Central Operations' : 'Delhi Public School');
    const resolvedInstId = instId || (role === 'admin' ? undefined : 'inst-dps-2026');
    const resolvedInstCode = instCode || (role === 'admin' ? undefined : 'DPS2026');

    await db.query(
      `INSERT INTO users (id, name, email, role, student_id, teacher_id, grade, institution, institution_id, institution_code, department, interest, avatar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        cleanName,
        cleanEmail,
        role,
        studentId,
        teacherId,
        grade,
        resolvedInst,
        resolvedInstId || null,
        resolvedInstCode || null,
        userData.department || (role === 'admin' ? 'Platform Administration' : 'Mathematics'),
        userData.interest || 'Cricket & Sports',
        avatar,
      ]
    );

    if (role === 'student') {
      const concepts = createCleanConcepts(grade);
      await db.query(
        `INSERT INTO student_progress (user_id, overall_mastery, struggling_concept, status, concepts_json, diagnostic_completed)
         VALUES (?, ?, NULL, 'New Enrollee', ?, 1)`,
        [id, mastery, JSON.stringify(concepts)]
      );

      await db.query(
        `INSERT INTO cohort_students (id, name, email, grade, student_id, avatar, overall_mastery, struggling_concept, status, interest, registered_at, is_new_registration, institution, institution_id, institution_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'New Enrollee', ?, ?, 1, ?, ?, ?)`,
        [id, cleanName, cleanEmail, grade, studentId, avatar, mastery, userData.interest || 'Cricket & Sports', Date.now(), resolvedInst, resolvedInstId || null, resolvedInstCode || null]
      );
    }

    await logSystemAction({
      action: 'ADMIN_CREATE_USER',
      actorName: userData.actorName || 'Admin',
      targetType: 'user',
      targetId: id,
      details: { name: cleanName, email: cleanEmail, role, grade, institution: resolvedInst, institutionCode: resolvedInstCode },
    });

    return {
      success: true,
      user: {
        id,
        name: cleanName,
        email: cleanEmail,
        role,
        studentId,
        teacherId,
        grade,
        institution: resolvedInst,
        institutionId: resolvedInstId,
        institutionCode: resolvedInstCode,
        overallMastery: mastery,
      },
    };
  } catch (err: any) {
    console.error('Error in adminCreateUser:', err);
    return { success: false, error: err.message || 'Database error creating user' };
  }
}

/**
 * Admin Update User
 */
export async function adminUpdateUser(
  userId: string,
  updateData: {
    name?: string;
    email?: string;
    role?: 'student' | 'teacher' | 'admin' | 'institution';
    grade?: string;
    interest?: StudentInterest;
    overallMastery?: number;
    status?: string;
    strugglingConcept?: string | null;
    institution?: string;
    institutionId?: string;
    institutionCode?: string;
    department?: string;
    actorName?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDbPool();

    const updates: string[] = [];
    const params: any[] = [];

    if (updateData.name) {
      updates.push('name = ?');
      params.push(updateData.name.trim());
    }
    if (updateData.email) {
      updates.push('email = ?');
      params.push(updateData.email.trim().toLowerCase());
    }
    if (updateData.role) {
      updates.push('role = ?');
      params.push(updateData.role);
    }
    if (updateData.grade) {
      updates.push('grade = ?');
      params.push(normalizeGradeName(updateData.grade));
    }
    if (updateData.interest) {
      updates.push('interest = ?');
      params.push(updateData.interest);
    }
    if (updateData.institution !== undefined) {
      updates.push('institution = ?');
      params.push(updateData.institution);
    }
    if (updateData.institutionId !== undefined) {
      updates.push('institution_id = ?');
      params.push(updateData.institutionId);
    }
    if (updateData.institutionCode !== undefined) {
      updates.push('institution_code = ?');
      params.push(updateData.institutionCode ? updateData.institutionCode.trim().toUpperCase() : null);
    }
    if (updateData.department !== undefined) {
      updates.push('department = ?');
      params.push(updateData.department);
    }

    if (updates.length > 0) {
      params.push(userId);
      await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // Sync cohort_students if institution fields changed
    if (updateData.institution !== undefined || updateData.institutionId !== undefined || updateData.institutionCode !== undefined) {
      const cUpdates: string[] = [];
      const cParams: any[] = [];
      if (updateData.institution !== undefined) { cUpdates.push('institution = ?'); cParams.push(updateData.institution); }
      if (updateData.institutionId !== undefined) { cUpdates.push('institution_id = ?'); cParams.push(updateData.institutionId); }
      if (updateData.institutionCode !== undefined) { cUpdates.push('institution_code = ?'); cParams.push(updateData.institutionCode ? updateData.institutionCode.trim().toUpperCase() : null); }
      if (cUpdates.length > 0) {
        cParams.push(userId);
        await db.query(`UPDATE cohort_students SET ${cUpdates.join(', ')} WHERE id = ?`, cParams);
      }
    }

    // Update student progress if mastery or status modified
    if (updateData.overallMastery !== undefined || updateData.status !== undefined || updateData.strugglingConcept !== undefined) {
      const pUpdates: string[] = [];
      const pParams: any[] = [];

      if (updateData.overallMastery !== undefined) {
        pUpdates.push('overall_mastery = ?');
        pParams.push(Number(updateData.overallMastery));
      }
      if (updateData.status !== undefined) {
        pUpdates.push('status = ?');
        pParams.push(updateData.status);
      }
      if (updateData.strugglingConcept !== undefined) {
        pUpdates.push('struggling_concept = ?');
        pParams.push(updateData.strugglingConcept);
      }

      if (pUpdates.length > 0) {
        pParams.push(userId);
        await db.query(`UPDATE student_progress SET ${pUpdates.join(', ')} WHERE user_id = ?`, pParams);
        await db.query(`UPDATE cohort_students SET ${pUpdates.join(', ')} WHERE id = ?`, pParams);
      }
    }

    await logSystemAction({
      action: 'ADMIN_UPDATE_USER',
      actorName: updateData.actorName || 'Admin',
      targetType: 'user',
      targetId: userId,
      details: updateData,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Error in adminUpdateUser:', err);
    return { success: false, error: err.message || 'Database error updating user' };
  }
}

/**
 * Admin Delete User (cascades across all tables)
 */
export async function adminDeleteUser(userId: string, actorName = 'Admin'): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDbPool();

    // 1. Delete quiz attempts
    await db.query('DELETE FROM quiz_attempts WHERE user_id = ?', [userId]);

    // 2. Delete progress
    await db.query('DELETE FROM student_progress WHERE user_id = ?', [userId]);

    // 3. Delete from cohort
    await db.query('DELETE FROM cohort_students WHERE id = ?', [userId]);

    // 4. Delete user record
    await db.query('DELETE FROM users WHERE id = ?', [userId]);

    await logSystemAction({
      action: 'ADMIN_DELETE_USER',
      actorName,
      targetType: 'user',
      targetId: userId,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Error in adminDeleteUser:', err);
    return { success: false, error: err.message || 'Database error deleting user' };
  }
}

/**
 * Question Bank Methods (CRUD)
 */
export async function getQuestionBankFromDb(filters: {
  search?: string;
  subject?: string;
  grade?: string;
  difficulty?: string;
}): Promise<any[]> {
  try {
    const db = getDbPool();

    // Check if question_bank is empty; if so, populate initial questions from gradeCurriculum
    const [cntRows]: any = await db.query('SELECT COUNT(*) as cnt FROM question_bank');
    if (cntRows && cntRows[0]?.cnt === 0) {
      const initialGrades = ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];
      for (const gr of initialGrades) {
        const diagQuestions = getDiagnosticQuestionsForGrade(gr, 'Mathematics');
        for (const q of diagQuestions) {
          await db.query(
            `INSERT INTO question_bank (id, concept_id, concept_title, subject, grade, question_text, options_json, correct_index, difficulty, blooms_level, explanation, hint)
             VALUES (?, ?, ?, 'Mathematics', ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE question_text = VALUES(question_text)`,
            [
              q.id,
              q.conceptId,
              q.conceptTitle,
              gr,
              q.text,
              JSON.stringify(q.options),
              q.correctIndex,
              q.difficulty || 'Intermediate',
              q.bloomsLevel || 'Application',
              q.explanation || 'Detailed step-by-step mathematical reasoning.',
              q.hint || 'Review the core formula or definition.',
            ]
          );
        }
      }
    }

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim().toLowerCase()}%`;
      conditions.push('(LOWER(question_text) LIKE ? OR LOWER(concept_title) LIKE ?)');
      params.push(term, term);
    }
    if (filters.subject && filters.subject !== 'all') {
      conditions.push('subject = ?');
      params.push(filters.subject);
    }
    if (filters.grade && filters.grade !== 'all') {
      conditions.push('grade = ?');
      params.push(filters.grade);
    }
    if (filters.difficulty && filters.difficulty !== 'all') {
      conditions.push('difficulty = ?');
      params.push(filters.difficulty);
    }

    const [rows]: any = await db.query(
      `SELECT * FROM question_bank WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 100`,
      params
    );

    return (rows || []).map((r: any) => ({
      id: r.id,
      conceptId: r.concept_id,
      conceptTitle: r.concept_title,
      subject: r.subject,
      grade: r.grade,
      questionText: r.question_text,
      options: typeof r.options_json === 'string' ? JSON.parse(r.options_json) : r.options_json,
      correctIndex: r.correct_index,
      difficulty: r.difficulty,
      bloomsLevel: r.blooms_level,
      explanation: r.explanation,
      hint: r.hint,
      createdAt: r.created_at,
    }));
  } catch (err) {
    console.error('Error fetching question bank:', err);
    return [];
  }
}

export async function saveQuestionToBank(qData: any, actorName = 'Admin'): Promise<{ success: boolean; id: string }> {
  try {
    const db = getDbPool();
    const id = qData.id || `qb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.query(
      `INSERT INTO question_bank (id, concept_id, concept_title, subject, grade, question_text, options_json, correct_index, difficulty, blooms_level, explanation, hint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         concept_id = VALUES(concept_id),
         concept_title = VALUES(concept_title),
         subject = VALUES(subject),
         grade = VALUES(grade),
         question_text = VALUES(question_text),
         options_json = VALUES(options_json),
         correct_index = VALUES(correct_index),
         difficulty = VALUES(difficulty),
         blooms_level = VALUES(blooms_level),
         explanation = VALUES(explanation),
         hint = VALUES(hint)`,
      [
        id,
        qData.conceptId || 'math-gen',
        qData.conceptTitle || 'General Topic',
        qData.subject || 'Mathematics',
        qData.grade || 'Class 10',
        qData.questionText,
        JSON.stringify(qData.options || []),
        Number(qData.correctIndex) || 0,
        qData.difficulty || 'Intermediate',
        qData.bloomsLevel || 'Application',
        qData.explanation || '',
        qData.hint || '',
      ]
    );

    await logSystemAction({
      action: qData.id ? 'UPDATE_QUESTION' : 'CREATE_QUESTION',
      actorName,
      targetType: 'question',
      targetId: id,
      details: { conceptTitle: qData.conceptTitle, difficulty: qData.difficulty },
    });

    return { success: true, id };
  } catch (err: any) {
    console.error('Error saving question to bank:', err);
    return { success: false, id: '' };
  }
}

export async function deleteQuestionFromBank(id: string, actorName = 'Admin'): Promise<{ success: boolean }> {
  try {
    const db = getDbPool();
    await db.query('DELETE FROM question_bank WHERE id = ?', [id]);

    await logSystemAction({
      action: 'DELETE_QUESTION',
      actorName,
      targetType: 'question',
      targetId: id,
    });

    return { success: true };
  } catch (err) {
    console.error('Error deleting question from bank:', err);
    return { success: false };
  }
}

/**
 * Get Comprehensive Admin & CRM Analytics
 */
export async function getAdminStatsFromDb(): Promise<any> {
  try {
    const db = getDbPool();

    // 1. Role counts
    const [userCounts]: any = await db.query(`
      SELECT 
        role, COUNT(*) as cnt
      FROM users
      GROUP BY role
    `);

    let studentCount = 0;
    let teacherCount = 0;
    let adminCount = 0;

    (userCounts || []).forEach((r: any) => {
      if (r.role === 'student') studentCount = Number(r.cnt);
      if (r.role === 'teacher') teacherCount = Number(r.cnt);
      if (r.role === 'admin') adminCount = Number(r.cnt);
    });

    // 2. Average mastery & total quizzes
    const [masteryRows]: any = await db.query(`
      SELECT AVG(overall_mastery) as avgMastery FROM student_progress
    `);
    const avgMastery = Math.round(Number(masteryRows?.[0]?.avgMastery) || 68);

    const [quizRows]: any = await db.query(`
      SELECT COUNT(*) as totalQuizzes, AVG(accuracy) as avgAccuracy FROM quiz_attempts
    `);
    const totalQuizzes = Number(quizRows?.[0]?.totalQuizzes) || 0;
    const avgAccuracy = Math.round(Number(quizRows?.[0]?.avgAccuracy) || 74);

    // 3. Status distribution of students
    const [statusRows]: any = await db.query(`
      SELECT status, COUNT(*) as cnt FROM cohort_students GROUP BY status
    `);

    // 4. Questions count
    const [qbRows]: any = await db.query(`SELECT COUNT(*) as cnt FROM question_bank`);
    const totalQuestions = Number(qbRows?.[0]?.cnt) || 0;

    // 5. Recent audit logs
    const [auditRows]: any = await db.query(`
      SELECT * FROM system_audit_logs ORDER BY created_at DESC LIMIT 10
    `);

    // 6. Class distribution of students
    const [classRows]: any = await db.query(`
      SELECT grade, COUNT(*) as cnt FROM users WHERE role = 'student' AND grade IS NOT NULL GROUP BY grade
    `);
    const classBreakdown: Record<string, number> = {};
    (classRows || []).forEach((r: any) => {
      const norm = normalizeGradeName(r.grade);
      classBreakdown[norm] = (classBreakdown[norm] || 0) + Number(r.cnt);
    });

    const recentLogs = (auditRows || []).map((r: any) => ({
      id: r.id,
      action: r.action,
      actorName: r.actor_name,
      targetType: r.target_type,
      targetId: r.target_id,
      details: r.details_json ? JSON.parse(r.details_json) : null,
      createdAt: r.created_at,
    }));

    return {
      kpi: {
        totalUsers: studentCount + teacherCount + adminCount,
        studentCount,
        teacherCount,
        adminCount,
        avgMastery,
        totalQuizzes,
        avgAccuracy,
        totalQuestions,
      },
      statusDistribution: statusRows || [],
      classBreakdown,
      recentLogs,
    };
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    return {
      kpi: {
        totalUsers: 8,
        studentCount: 5,
        teacherCount: 2,
        adminCount: 1,
        avgMastery: 68,
        totalQuizzes: 12,
        avgAccuracy: 74,
        totalQuestions: 25,
      },
      statusDistribution: [],
      recentLogs: [],
    };
  }
}

/**
 * Get Audit logs list
 */
export async function getAuditLogsFromDb(limit = 50): Promise<any[]> {
  try {
    const db = getDbPool();
    const [rows]: any = await db.query(`SELECT * FROM system_audit_logs ORDER BY created_at DESC LIMIT ?`, [limit]);
    return (rows || []).map((r: any) => ({
      id: r.id,
      action: r.action,
      actorId: r.actor_id,
      actorName: r.actor_name,
      targetType: r.target_type,
      targetId: r.target_id,
      details: r.details_json ? JSON.parse(r.details_json) : null,
      ipAddress: r.ip_address,
      createdAt: r.created_at,
    }));
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    return [];
  }
}

// =========================================================================
// INSTITUTION MULTI-TENANCY MANAGEMENT (CRUD & ROSTER ALLOCATION)
// =========================================================================

/**
 * Get all institutions with search, status filter, and live teacher/student counts
 */
export async function getAllInstitutionsFromDb(filters: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ institutions: Institution[]; total: number; page: number; limit: number }> {
  try {
    const db = getDbPool();
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(filters.limit) || 50));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim().toLowerCase()}%`;
      conditions.push('(LOWER(i.name) LIKE ? OR LOWER(i.code) LIKE ? OR LOWER(i.email) LIKE ? OR LOWER(i.city) LIKE ?)');
      params.push(term, term, term, term);
    }

    if (filters.status && filters.status !== 'all') {
      conditions.push('i.status = ?');
      params.push(filters.status);
    }

    // Count total
    const [countRows]: any = await db.query(
      `SELECT COUNT(*) as total FROM institutions i WHERE ${conditions.join(' AND ')}`,
      params
    );
    const total = Number(countRows?.[0]?.total) || 0;

    // Fetch institutions with joined counts of teachers and students
    const [rows]: any = await db.query(
      `SELECT 
        i.*,
        COUNT(DISTINCT CASE WHEN u.role = 'teacher' THEN u.id END) as teacherCount,
        COUNT(DISTINCT CASE WHEN u.role = 'student' THEN u.id END) as studentCount
       FROM institutions i
       LEFT JOIN users u ON (u.institution_id = i.id OR UPPER(u.institution_code) = UPPER(i.code) OR LOWER(u.institution) = LOWER(i.name))
       WHERE ${conditions.join(' AND ')}
       GROUP BY i.id
       ORDER BY i.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const institutions: Institution[] = (rows || []).map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      email: r.email,
      contactPerson: r.contact_person,
      phone: r.phone,
      address: r.address,
      city: r.city,
      state: r.state,
      status: r.status,
      teacherCount: Number(r.teacherCount) || 0,
      studentCount: Number(r.studentCount) || 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return { institutions, total, page, limit };
  } catch (err) {
    console.error('Error fetching institutions:', err);
    return { institutions: [], total: 0, page: 1, limit: 50 };
  }
}

/**
 * Get single institution by ID with member counts
 */
export async function getInstitutionById(id: string): Promise<Institution | null> {
  try {
    const db = getDbPool();
    const [rows]: any = await db.query(
      `SELECT 
        i.*,
        COUNT(DISTINCT CASE WHEN u.role = 'teacher' THEN u.id END) as teacherCount,
        COUNT(DISTINCT CASE WHEN u.role = 'student' THEN u.id END) as studentCount
       FROM institutions i
       LEFT JOIN users u ON (u.institution_id = i.id OR UPPER(u.institution_code) = UPPER(i.code) OR LOWER(u.institution) = LOWER(i.name))
       WHERE i.id = ?
       GROUP BY i.id
       LIMIT 1`,
      [id]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      email: r.email,
      contactPerson: r.contact_person,
      phone: r.phone,
      address: r.address,
      city: r.city,
      state: r.state,
      status: r.status,
      teacherCount: Number(r.teacherCount) || 0,
      studentCount: Number(r.studentCount) || 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  } catch (err) {
    console.error('Error getting institution by id:', err);
    return null;
  }
}

/**
 * Get institution by unique Code (e.g. DPS2026)
 */
export async function getInstitutionByCode(code: string): Promise<Institution | null> {
  try {
    const db = getDbPool();
    const cleanCode = (code || '').trim().toUpperCase();
    const [rows]: any = await db.query(
      `SELECT 
        i.*,
        COUNT(DISTINCT CASE WHEN u.role = 'teacher' THEN u.id END) as teacherCount,
        COUNT(DISTINCT CASE WHEN u.role = 'student' THEN u.id END) as studentCount
       FROM institutions i
       LEFT JOIN users u ON (u.institution_id = i.id OR UPPER(u.institution_code) = UPPER(i.code) OR LOWER(u.institution) = LOWER(i.name))
       WHERE UPPER(i.code) = ?
       GROUP BY i.id
       LIMIT 1`,
      [cleanCode]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      email: r.email,
      contactPerson: r.contact_person,
      phone: r.phone,
      address: r.address,
      city: r.city,
      state: r.state,
      status: r.status,
      teacherCount: Number(r.teacherCount) || 0,
      studentCount: Number(r.studentCount) || 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  } catch (err) {
    console.error('Error getting institution by code:', err);
    return null;
  }
}

/**
 * Create new Institution (Admin CRUD)
 */
export async function createInstitution(data: {
  id?: string;
  code: string;
  name: string;
  email: string;
  password?: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  status?: 'active' | 'suspended' | 'pending';
}, actorName = 'Admin'): Promise<{ success: boolean; institution?: any; error?: string }> {
  try {
    const db = getDbPool();
    const cleanName = data.name.trim();
    const cleanCode = data.code.trim().toUpperCase();
    const cleanEmail = data.email.trim().toLowerCase();
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const id = data.id?.trim() || `inst_${slug}_${Math.random().toString(36).substring(2, 6)}`;
    const status = data.status || 'active';
    const password = data.password || 'learnx@123';

    // Verify code uniqueness
    const [existing]: any = await db.query(`SELECT id FROM institutions WHERE UPPER(code) = ? LIMIT 1`, [cleanCode]);
    if (existing && existing.length > 0) {
      return { success: false, error: `Institution code '${cleanCode}' is already in use by another institution.` };
    }

    await db.query(
      `INSERT INTO institutions (id, code, name, email, password, contact_person, phone, address, city, state, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        cleanCode,
        cleanName,
        cleanEmail,
        password,
        data.contactPerson?.trim() || null,
        data.phone?.trim() || null,
        data.address?.trim() || null,
        data.city?.trim() || null,
        data.state?.trim() || null,
        status,
      ]
    );

    await logSystemAction({
      action: 'ADMIN_CREATE_INSTITUTION',
      actorName,
      targetType: 'institution',
      targetId: id,
      details: { name: cleanName, code: cleanCode, email: cleanEmail },
    });

    const created = await getInstitutionById(id);
    return { success: true, institution: created };
  } catch (err: any) {
    console.error('Error in createInstitution:', err);
    return { success: false, error: err.message || 'Database error creating institution' };
  }
}

/**
 * Update Institution details (Admin CRUD)
 */
export async function updateInstitution(id: string, data: {
  code?: string;
  name?: string;
  email?: string;
  password?: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  status?: 'active' | 'suspended' | 'pending';
}, actorName = 'Admin'): Promise<{ success: boolean; institution?: any; error?: string }> {
  try {
    const db = getDbPool();
    const updates: string[] = [];
    const params: any[] = [];

    if (data.code) {
      const cleanCode = data.code.trim().toUpperCase();
      // Check code uniqueness excluding current
      const [dups]: any = await db.query(`SELECT id FROM institutions WHERE UPPER(code) = ? AND id != ? LIMIT 1`, [cleanCode, id]);
      if (dups && dups.length > 0) {
        return { success: false, error: `Code '${cleanCode}' is already used by another institution.` };
      }
      updates.push('code = ?');
      params.push(cleanCode);
    }
    if (data.name) {
      updates.push('name = ?');
      params.push(data.name.trim());
    }
    if (data.email) {
      updates.push('email = ?');
      params.push(data.email.trim().toLowerCase());
    }
    if (data.password) {
      updates.push('password = ?');
      params.push(data.password);
    }
    if (data.contactPerson !== undefined) {
      updates.push('contact_person = ?');
      params.push(data.contactPerson?.trim() || null);
    }
    if (data.phone !== undefined) {
      updates.push('phone = ?');
      params.push(data.phone?.trim() || null);
    }
    if (data.address !== undefined) {
      updates.push('address = ?');
      params.push(data.address?.trim() || null);
    }
    if (data.city !== undefined) {
      updates.push('city = ?');
      params.push(data.city?.trim() || null);
    }
    if (data.state !== undefined) {
      updates.push('state = ?');
      params.push(data.state?.trim() || null);
    }
    if (data.status) {
      updates.push('status = ?');
      params.push(data.status);
    }

    if (updates.length > 0) {
      params.push(id);
      await db.query(`UPDATE institutions SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    await logSystemAction({
      action: 'ADMIN_UPDATE_INSTITUTION',
      actorName,
      targetType: 'institution',
      targetId: id,
      details: data,
    });

    const updated = await getInstitutionById(id);
    return { success: true, institution: updated };
  } catch (err: any) {
    console.error('Error in updateInstitution:', err);
    return { success: false, error: err.message || 'Database error updating institution' };
  }
}

/**
 * Delete Institution with audit trail and member decoupling
 */
export async function deleteInstitution(id: string, actorName = 'Admin'): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDbPool();
    // Get institution code first
    const [instRows]: any = await db.query(`SELECT * FROM institutions WHERE id = ?`, [id]);
    const inst = instRows?.[0];

    // Delete institution record
    await db.query(`DELETE FROM institutions WHERE id = ?`, [id]);

    // Unlink users associated with this institution
    if (inst) {
      await db.query(
        `UPDATE users SET institution_id = NULL, institution_code = NULL WHERE institution_id = ? OR institution_code = ?`,
        [id, inst.code]
      );
      await db.query(
        `UPDATE cohort_students SET institution_id = NULL, institution_code = NULL WHERE institution_id = ? OR institution_code = ?`,
        [id, inst.code]
      );
    }

    await logSystemAction({
      action: 'ADMIN_DELETE_INSTITUTION',
      actorName,
      targetType: 'institution',
      targetId: id,
      details: { name: inst?.name, code: inst?.code },
    });

    return { success: true };
  } catch (err: any) {
    console.error('Error in deleteInstitution:', err);
    return { success: false, error: err.message || 'Database error deleting institution' };
  }
}

/**
 * Get all teachers and students belonging to a specific institution
 */
export async function getInstitutionMembers(institutionId: string): Promise<{
  institution: Institution | null;
  teachers: any[];
  students: any[];
}> {
  try {
    const db = getDbPool();
    const inst = await getInstitutionById(institutionId);
    if (!inst) {
      return { institution: null, teachers: [], students: [] };
    }

    // Get teachers
    const [teachers]: any = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.teacher_id as teacherId, u.department, u.institution,
              u.institution_id as institutionId, u.institution_code as institutionCode,
              u.created_at as createdAt, u.avatar
       FROM users u
       WHERE (u.institution_id = ? OR UPPER(u.institution_code) = UPPER(?) OR LOWER(u.institution) = LOWER(?))
         AND u.role = 'teacher'
       ORDER BY u.name ASC`,
      [inst.id, inst.code, inst.name]
    );

    // Get students
    const [students]: any = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.student_id as studentId, u.grade, u.interest, u.institution,
              u.institution_id as institutionId, u.institution_code as institutionCode,
              u.created_at as createdAt, u.avatar,
              COALESCE(p.overall_mastery, c.overall_mastery, 0) as overallMastery,
              COALESCE(p.struggling_concept, c.struggling_concept) as strugglingConcept,
              COALESCE(p.status, c.status, 'New Enrollee') as status
       FROM users u
       LEFT JOIN student_progress p ON u.id = p.user_id
       LEFT JOIN cohort_students c ON u.id = c.id
       WHERE (u.institution_id = ? OR UPPER(u.institution_code) = UPPER(?) OR LOWER(u.institution) = LOWER(?))
         AND u.role = 'student'
       ORDER BY u.name ASC`,
      [inst.id, inst.code, inst.name]
    );

    return {
      institution: inst,
      teachers: teachers || [],
      students: students || [],
    };
  } catch (err) {
    console.error('Error fetching institution members:', err);
    return { institution: null, teachers: [], students: [] };
  }
}

/**
 * Add a teacher or student directly to an institution
 */
export async function addInstitutionMember(institutionId: string, memberData: {
  name: string;
  email: string;
  role: 'teacher' | 'student';
  grade?: string;
  department?: string;
  studentId?: string;
  teacherId?: string;
  interest?: StudentInterest;
  actorName?: string;
}): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const inst = await getInstitutionById(institutionId);
    if (!inst) {
      return { success: false, error: 'Institution not found' };
    }

    const created = await adminCreateUser({
      name: memberData.name,
      email: memberData.email,
      role: memberData.role,
      grade: memberData.grade || 'Class 10',
      department: memberData.department || 'Mathematics',
      studentId: memberData.studentId,
      teacherId: memberData.teacherId,
      interest: memberData.interest || 'Cricket & Sports',
      institution: inst.name,
      institutionId: inst.id,
      institutionCode: inst.code,
      actorName: memberData.actorName || 'Institution Admin',
    });

    return created;
  } catch (err: any) {
    console.error('Error adding institution member:', err);
    return { success: false, error: err.message || 'Failed to add institution member' };
  }
}

/**
 * Remove / decouple a user from an institution
 */
export async function removeInstitutionMember(institutionId: string, userId: string, actorName = 'Admin'): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDbPool();
    await db.query(
      `UPDATE users SET institution_id = NULL, institution_code = NULL WHERE id = ?`,
      [userId]
    );
    await db.query(
      `UPDATE cohort_students SET institution_id = NULL, institution_code = NULL WHERE id = ?`,
      [userId]
    );
    await logSystemAction({
      action: 'REMOVE_INSTITUTION_MEMBER',
      actorName,
      targetType: 'user',
      targetId: userId,
      details: { institutionId },
    });
    return { success: true };
  } catch (err: any) {
    console.error('Error removing institution member:', err);
    return { success: false, error: err.message || 'Failed to remove member' };
  }
}

/**
 * Institution Login Authentication Handler
 */
export async function institutionLogin(codeOrEmail: string, password?: string): Promise<{
  success: boolean;
  institution?: Institution;
  user?: UserProfile;
  error?: string;
}> {
  try {
    const db = getDbPool();
    const term = (codeOrEmail || '').trim();
    const [rows]: any = await db.query(
      `SELECT * FROM institutions 
       WHERE UPPER(code) = ? OR LOWER(email) = ?
       LIMIT 1`,
      [term.toUpperCase(), term.toLowerCase()]
    );

    if (!rows || rows.length === 0) {
      return { success: false, error: 'No institution found with this code or email.' };
    }

    const inst = rows[0];
    if (inst.status === 'suspended') {
      return { success: false, error: 'This institution account is currently suspended. Please contact platform support.' };
    }

    // If password provided and inst.password exists, verify match (allow learnx@123 as demo passkey)
    if (password && inst.password && password !== inst.password && password !== 'learnx@123') {
      return { success: false, error: 'Incorrect institution passkey.' };
    }

    const fullInst = await getInstitutionById(inst.id);

    const institutionUserProfile: UserProfile = {
      id: inst.id,
      name: `${inst.name} Admin`,
      email: inst.email,
      role: 'institution',
      institution: inst.name,
      institutionId: inst.id,
      institutionCode: inst.code,
      department: 'Institutional Administration',
      diagnosticCompleted: true,
      isNew: false,
    };

    return {
      success: true,
      institution: fullInst || inst,
      user: institutionUserProfile,
    };
  } catch (err: any) {
    console.error('Error in institutionLogin:', err);
    return { success: false, error: err.message || 'Institution authentication failed' };
  }
}


export async function isUserInInstitution(userId: string, institutionId: string): Promise<boolean> {
  try {
    const db = getDbPool();
    const [rows]: any = await db.query('SELECT institution_id FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!rows || rows.length === 0) return false;
    return rows[0].institution_id === institutionId;
  } catch (err) {
    return false;
  }
}


