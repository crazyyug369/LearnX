import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { getDbPool, authenticateOrEnrollUser, institutionLogin, getCurrentAuthorizationAccount } from './serverDb.js';
import { validate } from './middleware/validate.js';
import { loginSchema, registerSchema, institutionLoginSchema, claimPasswordSchema, forgotPasswordSchema } from './middleware/schemas.js';
import { isLocalLegacyAuthEnabled, isLoopbackRequest } from './security/authorization.js';
import { isDatabaseUnavailable } from './security/errors.js';
import { PASSWORD_HASH_ROUNDS, isSupportedPassword } from './security/passwords.js';

interface TokenPayload {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  institutionId?: string;
  exp: number;
  iat: number;
}

type UserRole = 'student' | 'teacher' | 'admin' | 'institution';

const allowedRoles = new Set<UserRole>(['student', 'teacher', 'admin', 'institution']);
const isProduction = () => process.env.NODE_ENV === 'production';
const isLegacyAuthEnabled = (req: any) => isLocalLegacyAuthEnabled() && isLoopbackRequest(req);

const isTokenPayload = (value: unknown): value is TokenPayload => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.id === 'string' && payload.id.length > 0 &&
    typeof payload.email === 'string' && payload.email.length > 0 &&
    typeof payload.name === 'string' && payload.name.length > 0 &&
    typeof payload.role === 'string' && allowedRoles.has(payload.role as UserRole) &&
    (payload.institutionId === undefined || (typeof payload.institutionId === 'string' && payload.institutionId.length > 0)) &&
    typeof payload.exp === 'number' && Number.isFinite(payload.exp) &&
    typeof payload.iat === 'number' && Number.isFinite(payload.iat) &&
    payload.iat <= Date.now() / 1000 + 30 && payload.exp > payload.iat && payload.exp - payload.iat <= 4 * 60 * 60
  );
};

const setupRequiredResponse = () => ({
  success: false,
  error: 'Account setup required',
  needsClaim: true,
});

const toPublicInstitution = (institution: any) => {
  if (!institution) return undefined;

  return {
    id: institution.id,
    code: institution.code,
    name: institution.name,
    email: institution.email,
    contactPerson: institution.contactPerson ?? institution.contact_person,
    phone: institution.phone,
    address: institution.address,
    city: institution.city,
    state: institution.state,
    status: institution.status,
    teacherCount: institution.teacherCount,
    studentCount: institution.studentCount,
    createdAt: institution.createdAt ?? institution.created_at,
    updatedAt: institution.updatedAt ?? institution.updated_at,
  };
};

export const authRouter = express.Router();

const publicUser = (user: { id: string; name: string; email: string; role: UserRole; institutionId?: string }) => ({
  id: user.id, name: user.name, email: user.email, role: user.role, institutionId: user.institutionId,
});

async function readAuthenticatedUser(token: unknown, secret: string) {
  if (typeof token !== 'string') return null;
  let decoded: unknown;
  try { decoded = jwt.verify(token, secret, { algorithms: ['HS256'], maxAge: '4h' }); } catch { return null; }
  if (!isTokenPayload(decoded)) return null;
  if (isProduction() || process.env.REVALIDATE_AUTH_ACCOUNTS === 'true') {
    const account = await getCurrentAuthorizationAccount(decoded);
    if (!account || account.email !== decoded.email) return null;
    return publicUser(account);
  }
  return publicUser(decoded);
}

function authFailure(res: any, error: unknown) {
  return isDatabaseUnavailable(error)
    ? res.status(503).json({ success: false, error: 'Authentication temporarily unavailable' })
    : res.status(500).json({ success: false, error: 'Internal error' });
}

const unsupportedPasswordResponse = (res: any) => res.status(400).json({
  success: false, error: 'Password must contain at least 8 characters and at most 72 UTF-8 bytes',
});

// Middleware
export async function verifyToken(req: any, res: any, next: any) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // In production, fail fast; in dev also fail to avoid accidental insecure fallback
    return res.status(500).json({ success: false, error: 'Server configuration error' });
  }
  try {
    const user = await readAuthenticatedUser(token, secret);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
    }
    req.user = user;
    next();
  } catch (err) {
    return authFailure(res, err);
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
    { expiresIn: '4h', algorithm: 'HS256' }
  );
  res.cookie('access_token', token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict',
    path: '/',
    maxAge: 4 * 60 * 60 * 1000 // 4 hours
  });
};

// Login Route
authRouter.post('/login', validate(loginSchema), async (req, res) => {
  if (isLegacyAuthEnabled(req)) {
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
      return res.status(500).json({ success: false, error: 'Login failed' });
    }
  }

  // --- New Secure Login ---
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required' });
    if (!isSupportedPassword(password)) return unsupportedPasswordResponse(res);
    const db = getDbPool();
    const [users]: any = await db.query(`SELECT id, name, email, role, password_hash, needs_password, institution_id as institutionId FROM users WHERE LOWER(email) = ? LIMIT 2`, [email.trim().toLowerCase()]);
    if (!users || users.length !== 1 || !allowedRoles.has(users[0].role) || users[0].role === 'institution') {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const user = users[0];

    if (user.needs_password) {
      return res.status(403).json(setupRequiredResponse());
    }

    if (!user.password_hash) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    if (isProduction()) {
      const current = await getCurrentAuthorizationAccount(user);
      if (!current) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    issueToken(res, user);
    return res.json({ success: true, user: publicUser(user) });
  } catch (err: any) {
    return authFailure(res, err);
  }
});

// Register Route
authRouter.post('/register', validate(registerSchema), async (req, res) => {
  if (isLegacyAuthEnabled(req)) {
    try {
      const { email, name, grade, interest, studentId, institution, institutionId, institutionCode, department, teacherId } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
      const result = await authenticateOrEnrollUser({
        email, name, role: 'student', grade, interest, studentId, institution, institutionId, institutionCode, department, teacherId,
      });
      if (result.user.role !== 'student') {
        return res.status(400).json({ success: false, error: 'Registration is limited to student accounts' });
      }
      return res.json({ success: true, user: result.user, conceptsMap: result.conceptsMap, overallMastery: result.overallMastery, isNew: result.isNew });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Registration failed' });
    }
  }

  // --- New Secure Register ---
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, error: 'Name, email, and password required' });
    if (!isSupportedPassword(password)) return unsupportedPasswordResponse(res);
    const db = getDbPool();
    const hash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
    const id = `usr_${randomUUID()}`;
    await db.query(
      `INSERT INTO users (id, name, email, password_hash, needs_password, role) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), email.trim().toLowerCase(), hash, false, 'student']
    );
    const user = { id, name: name.trim(), email: email.trim().toLowerCase(), role: 'student' as const };
    issueToken(res, user);
    return res.json({ success: true, user });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, error: 'Email already exists' });
    return authFailure(res, err);
  }
});

// Institution Login
authRouter.post('/institution-login', validate(institutionLoginSchema), async (req, res) => {
  if (isLegacyAuthEnabled(req)) {
     try {
       const { code, email, password } = req.body;
       const term = code || email;
       if (!term) return res.status(400).json({ success: false, error: 'Institution code or email required' });
        const result = await institutionLogin(term, password);
        if (!result.success) return res.status(401).json({ success: false, error: result.error || 'Invalid credentials' });
        return res.json({
          success: true,
          user: result.user,
          institution: toPublicInstitution(result.institution),
        });
     } catch (err: any) {
       return res.status(500).json({ success: false, error: 'Institution login failed' });
     }
  }

  // --- New Secure Institution Login ---
  try {
    const { code, email, password } = req.body;
    const term = code || email;
    if (!term || !password) return res.status(400).json({ success: false, error: 'Email/code and password required' });
    if (!isSupportedPassword(password)) return unsupportedPasswordResponse(res);
    const byEmail = !code && term.includes('@');
    const db = getDbPool();
    const [insts]: any = await db.query(`SELECT id, name, email, password_hash, code, needs_password, status FROM institutions WHERE ${byEmail ? 'LOWER(email)' : 'UPPER(code)'} = ? LIMIT 2`, [byEmail ? term.trim().toLowerCase() : term.trim().toUpperCase()]);

    if (!insts || insts.length !== 1) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const inst = insts[0];
    if (inst.status !== 'active') return res.status(403).json({ success: false, error: 'Institution is not active' });
    if (inst.needs_password) return res.status(403).json(setupRequiredResponse());
    if (!inst.password_hash) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, inst.password_hash);
    if (!match) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const user = { id: inst.id, name: `${inst.name} Admin`, email: inst.email, role: 'institution', institutionId: inst.id };
    issueToken(res, user);
    return res.json({ success: true, user, institution: toPublicInstitution(inst) });
  } catch (err: any) {
    return authFailure(res, err);
  }
});

authRouter.post('/claim-password', (req, res, next) => {
  if (!isLegacyAuthEnabled(req)) {
    return res.status(410).json({
      success: false,
      error: 'Password claiming is disabled in production and requires explicitly enabled local development. Invitation-based setup is not yet available.',
    });
  }
  next();
}, validate(claimPasswordSchema), async (req, res) => {
  try {
     const { email, newPassword } = req.body;
     if (!isSupportedPassword(newPassword)) return unsupportedPasswordResponse(res);
     const db = getDbPool();
     const [users]: any = await db.query(`SELECT id, needs_password FROM users WHERE LOWER(email) = ? LIMIT 2`, [email.toLowerCase()]);
     if (users && users.length === 1) {
       const u = users[0];
       if (u.needs_password) {
          const hash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);
          const [result]: any = await db.query(`UPDATE users SET password_hash = ?, needs_password = FALSE, password = NULL WHERE id = ? AND needs_password = TRUE`, [hash, u.id]);
          if (result.affectedRows) return res.json({ success: true, message: 'Password set successfully.' });
       }
     }

     // Check institutions
     const [insts]: any = await db.query(`SELECT id, needs_password FROM institutions WHERE LOWER(email) = ? LIMIT 2`, [email.toLowerCase()]);
     if (insts && insts.length === 1) {
       const inst = insts[0];
       if (inst.needs_password) {
          const hash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);
          const [result]: any = await db.query(`UPDATE institutions SET password_hash = ?, needs_password = FALSE, password = NULL WHERE id = ? AND needs_password = TRUE`, [hash, inst.id]);
          if (result.affectedRows) return res.json({ success: true, message: 'Password set successfully.' });
       }
     }

     return res.status(400).json({ success: false, error: 'Cannot claim this account' });
  } catch (err) {
      return authFailure(res, err);
  }
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict',
    path: '/',
  });
  res.json({ success: true });
});

authRouter.get('/me', verifyToken, (req: any, res: any) => {
  res.json({ success: true, user: req.user });
});

// Session probe endpoint - returns auth status without exposing token details.
authRouter.get('/session', async (req: any, res: any) => {
  const token = req.cookies?.access_token;
  if (!token) {
    return res.json({ success: true, user: null });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ success: false, error: 'Server configuration error' });
  }

  try {
    return res.json({ success: true, user: await readAuthenticatedUser(token, secret) });
  } catch (err) {
    return authFailure(res, err);
  }
});



authRouter.post('/forgot-password', validate(forgotPasswordSchema), (_req, res) => {
  // Same response for every address. No transport or reset-token flow exists yet.
  return res.status(503).json({
    success: false,
    error: 'Password reset email delivery is not configured. Contact your institution administrator.',
  });
});
