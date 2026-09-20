import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDbPool, authenticateOrEnrollUser, institutionLogin } from './serverDb.js';
import { validate } from './middleware/validate.js';
import { loginSchema, registerSchema, institutionLoginSchema, claimPasswordSchema, forgotPasswordSchema } from './middleware/schemas.js';

export const authRouter = express.Router();

// Middleware
export function verifyToken(req: any, res: any, next: any) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // In production, fail fast; in dev also fail to avoid accidental insecure fallback
    return res.status(500).json({ success: false, error: 'Server configuration error' });
  }
  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
}

export function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
}

// Issue JWT helper
const issueToken = (res: any, user: any) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Should never happen if verifyToken is working, but fail safe
    throw new Error('JWT_SECRET not configured');
  }
  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email, institutionId: user.institutionId },
    secret,
    { expiresIn: '4h' }
  );
  res.cookie('access_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 4 * 60 * 60 * 1000 // 4 hours
  });
};

// Login Route
authRouter.post('/login', validate(loginSchema), async (req, res) => {
  if (process.env.ENABLE_LEGACY_AUTH === 'true') {
    // Wrap to prevent legacy implementation details from breaking the new router
    try {
      const { email, name, role, grade, interest, studentId, institution, institutionId, institutionCode, department, teacherId } = req.body;
      if (!email && !name && !institutionCode) {
        return res.status(400).json({ success: false, error: 'Email, username, or institution code is required' });
      }
      const result = await authenticateOrEnrollUser({
        email, name, role, grade, interest, studentId, institution, institutionId, institutionCode, department, teacherId,
      });
      return res.json({ success: true, user: result.user, conceptsMap: result.conceptsMap, overallMastery: result.overallMastery, isNew: result.isNew });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Login failed' });
    }
  }

  // --- New Secure Login ---
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required' });
    const db = getDbPool();
    const [users]: any = await db.query(`SELECT id, name, email, role, password_hash, needs_password, institution_id as institutionId FROM users WHERE LOWER(email) = ? OR LOWER(name) = ? LIMIT 1`, [email.toLowerCase(), email.toLowerCase()]);
    if (!users || users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const user = users[0];

    if (user.needs_password) {
      return res.status(403).json({ success: false, error: 'Account requires password setup.', needsClaim: true, userId: user.id });
    }

    if (!user.password_hash) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    issueToken(res, user);
    return res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// Register Route
authRouter.post('/register', validate(registerSchema), async (req, res) => {
  if (process.env.ENABLE_LEGACY_AUTH === 'true') {
    try {
      const { email, name, role, grade, interest, studentId, institution, institutionId, institutionCode, department, teacherId } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
      const result = await authenticateOrEnrollUser({
        email, name, role, grade, interest, studentId, institution, institutionId, institutionCode, department, teacherId,
      });
      return res.json({ success: true, user: result.user, conceptsMap: result.conceptsMap, overallMastery: result.overallMastery, isNew: result.isNew });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Registration failed' });
    }
  }

  // --- New Secure Register ---
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, error: 'Name, email, and password required' });
    const db = getDbPool();
    const hash = await bcrypt.hash(password, 10);
    const id = `usr_${Date.now()}`;
    await db.query(
      `INSERT INTO users (id, name, email, password_hash, needs_password, role) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, email, hash, false, role || 'student']
    );
    const user = { id, name, email, role: role || 'student' };
    issueToken(res, user);
    return res.json({ success: true, user });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, error: 'Email already exists' });
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// Institution Login
authRouter.post('/institution-login', validate(institutionLoginSchema), async (req, res) => {
  if (process.env.ENABLE_LEGACY_AUTH === 'true') {
     try {
       const { code, email, password } = req.body;
       const term = code || email;
       if (!term) return res.status(400).json({ success: false, error: 'Institution code or email required' });
       const result = await institutionLogin(term, password);
       if (!result.success) return res.status(401).json(result);
       return res.json(result);
     } catch (err: any) {
       return res.status(500).json({ success: false, error: 'Institution login failed' });
     }
  }

  // --- New Secure Institution Login ---
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email/code and password required' });
    const db = getDbPool();
    const [insts]: any = await db.query(`SELECT id, name, email, password_hash, code, needs_password, status FROM institutions WHERE LOWER(email) = ? OR UPPER(code) = ? LIMIT 1`, [email.toLowerCase(), email.toUpperCase()]);

    if (!insts || insts.length === 0) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const inst = insts[0];
    if (inst.status === 'suspended') return res.status(403).json({ success: false, error: 'Institution suspended' });
    if (inst.needs_password) return res.status(403).json({ success: false, error: 'Account requires password setup.', needsClaim: true, instId: inst.id });
    if (!inst.password_hash) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, inst.password_hash);
    if (!match) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const user = { id: inst.id, name: `${inst.name} Admin`, email: inst.email, role: 'institution', institutionId: inst.id };
    issueToken(res, user);
    return res.json({ success: true, user, institution: inst });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

authRouter.post('/claim-password', validate(claimPasswordSchema), async (req, res) => {
  try {
     const { email, newPassword } = req.body;
     const db = getDbPool();
     const [users]: any = await db.query(`SELECT id, needs_password FROM users WHERE LOWER(email) = ? LIMIT 1`, [email.toLowerCase()]);
     if (users && users.length > 0) {
       const u = users[0];
       if (u.needs_password) {
         const hash = await bcrypt.hash(newPassword, 10);
         await db.query(`UPDATE users SET password_hash = ?, needs_password = FALSE WHERE id = ?`, [hash, u.id]);
         return res.json({ success: true, message: 'Password set successfully.' });
       }
     }

     // Check institutions
     const [insts]: any = await db.query(`SELECT id, needs_password FROM institutions WHERE LOWER(email) = ? LIMIT 1`, [email.toLowerCase()]);
     if (insts && insts.length > 0) {
       const inst = insts[0];
       if (inst.needs_password) {
         const hash = await bcrypt.hash(newPassword, 10);
         await db.query(`UPDATE institutions SET password_hash = ?, needs_password = FALSE WHERE id = ?`, [hash, inst.id]);
         return res.json({ success: true, message: 'Password set successfully.' });
       }
     }

     return res.status(400).json({ success: false, error: 'Cannot claim this account' });
  } catch (err) {
     return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie('access_token');
  res.json({ success: true });
});

authRouter.get('/me', verifyToken, (req: any, res: any) => {
  res.json({ success: true, user: req.user });
});



authRouter.post('/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
  // Skeleton implementation for forgot password Phase 1
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });
    
    // In Phase 2, this will send an email with a secure token.
    // For now, return a generic success to prevent email enumeration.
    return res.json({ success: true, message: 'If an account exists with this email, a reset link will be sent.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});
