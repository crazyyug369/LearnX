import { ClassroomStudent, UserProfile, UserRole, StudentInterest, ConceptNode } from '../types';
import { INITIAL_CONCEPTS } from '../data/curriculumData';
import { apiFetch } from './apiClient';

const STORAGE_KEY = 'learnx_cohort_students_v3';
const STUDENT_CONCEPTS_PREFIX = 'learnx_student_concepts_';

// Enriched baseline students with grades and emails
// ONLY FOR DEMO/E2E DETERMINISTIC SEEDING - DO NOT DEPEND ON FOR PROD
const DEMO_BASELINE_STUDENTS: ClassroomStudent[] = [
  {
    id: 's-1',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@student.learnx.org',
    grade: 'Grade 10',
    studentId: 'STU-2026-1048',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
    overallMastery: 84,
    strugglingConcept: null,
    status: 'Excelling',
    lastActive: '12 mins ago',
    interest: 'Cricket & Sports',
    registeredAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
  },
  {
    id: 's-2',
    name: 'Diya Patel',
    email: 'diya.patel@student.learnx.org',
    grade: 'Grade 11',
    studentId: 'STU-2026-2104',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    overallMastery: 58,
    strugglingConcept: 'Quadratic Equations & Roots',
    status: 'Needs Intervention',
    lastActive: '5 mins ago',
    interest: 'Gaming & Sci-Fi',
    registeredAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
  {
    id: 's-3',
    name: 'Rohan Verma',
    email: 'rohan.verma@student.learnx.org',
    grade: 'Grade 10',
    studentId: 'STU-2026-3391',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
    overallMastery: 72,
    strugglingConcept: 'Parabolas & Trajectories',
    status: 'On Track',
    lastActive: '1 hour ago',
    interest: 'Robotics & Coding',
    registeredAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
  },
  {
    id: 's-4',
    name: 'Ananya Iyer',
    email: 'ananya.iyer@student.learnx.org',
    grade: 'Grade 10',
    studentId: 'STU-2026-4482',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80',
    overallMastery: 91,
    strugglingConcept: null,
    status: 'Excelling',
    lastActive: '30 mins ago',
    interest: 'Space & Astronomy',
    registeredAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
  },
  {
    id: 's-5',
    name: 'Kabir Mehta',
    email: 'kabir.mehta@student.learnx.org',
    grade: 'Grade 9',
    studentId: 'STU-2026-5509',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    overallMastery: 52,
    strugglingConcept: 'Linear Slope Baseline',
    status: 'Needs Intervention',
    lastActive: 'Just now',
    interest: 'Music & Creative Arts',
    registeredAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
];

/**
 * Deduplicate and sanitize classroom students:
 * 1. Strips any test timestamp suffixes (e.g. "Pooja Patel 1789298923" -> "Pooja Patel")
 * 2. Deduplicates by student ID, normalized email, and normalized name
 * 3. Filters out any educator profiles (Dr. Priya Rao, Prof. Vikram Sen)
 */
export function deduplicateStudents(students: ClassroomStudent[]): ClassroomStudent[] {
  if (!Array.isArray(students)) return [];
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();
  const deduped: ClassroomStudent[] = [];

  for (const s of students) {
    if (!s || !s.name) continue;
    const cleanName = s.name.replace(/\s+\d{6,}$/, '').trim();
    const emailKey = (s.email || '').toLowerCase().trim();
    const idKey = s.id;
    const nameKey = cleanName.toLowerCase();

    // Prevent educators from leaking into student roster
    if (nameKey.includes('dr. priya') || nameKey.includes('prof. vikram')) {
      continue;
    }

    if (idKey && seenIds.has(idKey)) continue;
    if (emailKey && seenEmails.has(emailKey)) continue;
    if (nameKey && seenNames.has(nameKey)) continue;

    if (idKey) seenIds.add(idKey);
    if (emailKey) seenEmails.add(emailKey);
    if (nameKey) seenNames.add(nameKey);

    deduped.push({
      ...s,
      name: cleanName,
      email: s.email ? s.email.replace(/_\d{6,}@/, '@') : s.email,
    });
  }

  return deduped;
}

/**
 * Retrieve current cohort students from localStorage or defaults
 */
export function getCohortStudents(): ClassroomStudent[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: ClassroomStudent[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return deduplicateStudents(parsed);
      }
    }
  } catch (err) {
    console.warn('Error reading cohort students from storage:', err);
  }

  // Initialize and persist baseline
  const dedupedBaseline = deduplicateStudents(DEMO_BASELINE_STUDENTS);
  saveCohortStudents(dedupedBaseline);
  return dedupedBaseline;
}

/**
 * Save cohort students to localStorage and broadcast event for immediate UI updates
 */
export function saveCohortStudents(students: ClassroomStudent[]): void {
  try {
    const deduped = deduplicateStudents(students);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
    window.dispatchEvent(new window.CustomEvent('learnx_cohort_updated', { detail: deduped }));
  } catch (err) {
    console.warn('Error saving cohort students to storage:', err);
  }
}

/**
 * Register or update a student in the cohort roster.
 * Newly registered students are prepended with `isNewRegistration: true` and status: 'New Enrollee'.
 */
export function registerStudentInCohort(
  profile: Partial<ClassroomStudent> & Partial<UserProfile> & { name: string; email?: string; role?: UserRole }
): ClassroomStudent | null {
  // Prevent students from mutating the teacher's cohort registry.
  // The server handles student progress securely; cohort list UI is for teachers only.
  if (profile.role === 'student') {
    return null;
  }

  const currentList = getCohortStudents();
  const emailMatch = (profile.email || '').toLowerCase().trim();
  const nameMatch = (profile.name || '').toLowerCase().trim();

  // Check if student already exists
  const existingIdx = currentList.findIndex((s) => {
    if (profile.id && s.id === profile.id) return true;
    if (emailMatch && s.email && s.email.toLowerCase() === emailMatch) return true;
    if (nameMatch && s.name.toLowerCase() === nameMatch) return true;
    return false;
  });

  let studentRecord: ClassroomStudent;

  if (existingIdx >= 0) {
    // Update existing student
    const existing = currentList[existingIdx];
    studentRecord = {
      ...existing,
      name: profile.name.trim() || existing.name,
      email: profile.email || existing.email,
      grade: profile.grade || existing.grade || 'Grade 10',
      studentId: profile.studentId || existing.studentId,
      interest: (profile.interest as StudentInterest) || existing.interest,
      avatar: profile.avatar || existing.avatar,
      lastActive: 'Active just now',
      isNewRegistration: true, // Mark so teacher can spot the update
    };
    currentList[existingIdx] = studentRecord;
  } else {
    // Generate avatar seed
    const avatar =
      profile.avatar ||
      `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 10000)}?w=100&auto=format&fit=crop&q=80`;

    // Create fresh record
    studentRecord = {
      id: profile.id || `student-${Date.now()}`,
      name: profile.name.trim(),
      email: profile.email || `${profile.name.toLowerCase().replace(/\s+/g, '.')}@student.learnx.org`,
      grade: profile.grade || 'Grade 10',
      studentId: profile.studentId || `STU-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      avatar: profile.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      overallMastery: 50, // Fresh baseline
      strugglingConcept: null,
      status: 'New Enrollee',
      lastActive: 'Just registered',
      interest: (profile.interest as StudentInterest) || 'Cricket & Sports',
      registeredAt: Date.now(),
      isNewRegistration: true,
    };

    // Prepend to list so newly registered students appear directly at the top
    currentList.unshift(studentRecord);
  }

  saveCohortStudents(currentList);

  // Background async sync with server
  apiFetch('/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentRecord),
  }).catch(() => {
    // Offline resilience: localStorage already updated
  });

  return studentRecord;
}

/**
 * Update real-time student mastery score when they complete assessments or lessons.
 * Matches by ID, studentId (e.g. STU-2026-1048), email, or name.
 */
export function updateStudentMasteryInCohort(
  identifier: string | { id?: string; studentId?: string; email?: string; name?: string },
  newScore: number,
  strugglingConcept: string | null = null
): void {
  const currentList = getCohortStudents();
  let idx = -1;

  if (typeof identifier === 'string') {
    const term = identifier.trim().toLowerCase();
    idx = currentList.findIndex(
      (s) =>
        s.id === identifier ||
        s.studentId?.toLowerCase() === term ||
        s.email?.toLowerCase() === term ||
        s.name.toLowerCase() === term
    );
  } else if (identifier) {
    const emailMatch = (identifier.email || '').toLowerCase().trim();
    const nameMatch = (identifier.name || '').toLowerCase().trim();
    const idMatch = identifier.id;
    const stuIdMatch = identifier.studentId?.toLowerCase().trim();

    idx = currentList.findIndex((s) => {
      if (idMatch && s.id === idMatch) return true;
      if (stuIdMatch && s.studentId?.toLowerCase() === stuIdMatch) return true;
      if (emailMatch && s.email && s.email.toLowerCase() === emailMatch) return true;
      if (nameMatch && s.name.toLowerCase() === nameMatch) return true;
      return false;
    });
  }

  if (idx < 0) return;

  const target = currentList[idx];
  let newStatus: ClassroomStudent['status'] = target.status;
  if (newScore >= 80) {
    newStatus = 'Excelling';
  } else if (newScore < 65) {
    newStatus = 'Needs Intervention';
  } else {
    newStatus = 'On Track';
  }

  const updated: ClassroomStudent = {
    ...target,
    overallMastery: Math.min(100, Math.max(0, Math.round(newScore))),
    strugglingConcept: strugglingConcept !== undefined ? strugglingConcept : target.strugglingConcept,
    status: newStatus,
    lastActive: 'Just now',
  };

  currentList[idx] = updated;
  saveCohortStudents(currentList);

  // Background async sync with server
  apiFetch(`/api/students/${target.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      overallMastery: updated.overallMastery,
      strugglingConcept: updated.strugglingConcept,
      status: updated.status,
    }),
  }).catch(() => {});
}

/**
 * Remove a student from cohort (e.g. unenroll from teacher portal)
 */
export function removeStudentFromCohort(studentId: string): ClassroomStudent[] {
  const currentList = getCohortStudents();
  const filtered = currentList.filter((s) => s.id !== studentId);
  saveCohortStudents(filtered);

  apiFetch(`/api/students/${studentId}`, {
    method: 'DELETE',
  }).catch(() => {});

  return filtered;
}

/**
 * Reset cohort to initial default baseline
 */
export function resetCohortToDefaults(): ClassroomStudent[] {
  saveCohortStudents(DEMO_BASELINE_STUDENTS);
  return DEMO_BASELINE_STUDENTS;
}

/**
 * Returns a clean curriculum map where all mastery scores are 0,
 * foundational concepts (no prerequisites) are in_progress/unlocked,
 * and downstream concepts are locked.
 */
export function getCleanCurriculumConcepts(): Record<string, ConceptNode[]> {
  const clean: Record<string, ConceptNode[]> = {};
  Object.keys(INITIAL_CONCEPTS).forEach((subj) => {
    clean[subj] = INITIAL_CONCEPTS[subj].map((c) => ({
      ...c,
      masteryScore: 0,
      status: c.prerequisites.length === 0 ? 'in_progress' : 'locked',
    }));
  });
  return clean;
}

/**
 * Generates starting concepts for recognized baseline students, or a fresh clean
 * curriculum for new student registrations.
 */
export function getDefaultConceptsForStudent(
  identifier?: string,
  name?: string
): Record<string, ConceptNode[]> {
  const idStr = (identifier || '').toLowerCase();
  const nameStr = (name || '').toLowerCase();

  // 1. Aarav Sharma (Default Demo Student 1: 53% math mastery)
  if (idStr === 's-1' || idStr === 'student-demo-1' || nameStr.includes('aarav')) {
    return JSON.parse(JSON.stringify(INITIAL_CONCEPTS));
  }

  // 2. Diya Patel (Demo Student 2: 58% math mastery, struggling on Quadratic Equations)
  if (idStr === 's-2' || idStr === 'student-demo-2' || nameStr.includes('diya')) {
    const diyaConcepts: Record<string, ConceptNode[]> = JSON.parse(JSON.stringify(INITIAL_CONCEPTS));
    diyaConcepts.Mathematics = diyaConcepts.Mathematics.map((c) => {
      if (c.id === 'math-1') return { ...c, masteryScore: 78, status: 'mastered' };
      if (c.id === 'math-2') return { ...c, masteryScore: 72, status: 'in_progress' };
      if (c.id === 'math-3') return { ...c, masteryScore: 42, status: 'remediation' };
      if (c.id === 'math-4') return { ...c, masteryScore: 0, status: 'locked' };
      if (c.id === 'math-5') return { ...c, masteryScore: 0, status: 'locked' };
      return c;
    });
    diyaConcepts.Physics = diyaConcepts.Physics.map((c) => {
      if (c.id === 'phy-1') return { ...c, masteryScore: 82, status: 'mastered' };
      if (c.id === 'phy-2') return { ...c, masteryScore: 60, status: 'in_progress' };
      if (c.id === 'phy-3') return { ...c, masteryScore: 38, status: 'remediation' };
      return { ...c, masteryScore: 0, status: 'locked' };
    });
    return diyaConcepts;
  }

  // 3. Rohan Verma (Demo Student 3: 72% math mastery, struggling on Parabolas)
  if (idStr === 's-3' || nameStr.includes('rohan')) {
    const rohanConcepts: Record<string, ConceptNode[]> = JSON.parse(JSON.stringify(INITIAL_CONCEPTS));
    rohanConcepts.Mathematics = rohanConcepts.Mathematics.map((c) => {
      if (c.id === 'math-1') return { ...c, masteryScore: 86, status: 'mastered' };
      if (c.id === 'math-2') return { ...c, masteryScore: 84, status: 'mastered' };
      if (c.id === 'math-3') return { ...c, masteryScore: 80, status: 'mastered' };
      if (c.id === 'math-4') return { ...c, masteryScore: 40, status: 'remediation' };
      if (c.id === 'math-5') return { ...c, masteryScore: 0, status: 'locked' };
      return c;
    });
    return rohanConcepts;
  }

  // 4. Ananya Iyer (Demo Student 4: 91% math mastery, excelling)
  if (idStr === 's-4' || nameStr.includes('ananya')) {
    const ananyaConcepts: Record<string, ConceptNode[]> = JSON.parse(JSON.stringify(INITIAL_CONCEPTS));
    ananyaConcepts.Mathematics = ananyaConcepts.Mathematics.map((c) => ({
      ...c,
      masteryScore: 92,
      status: 'mastered',
    }));
    return ananyaConcepts;
  }

  // 5. Kabir Mehta (Demo Student 5: 52% math mastery, struggling on Linear Equations)
  if (idStr === 's-5' || nameStr.includes('kabir')) {
    const kabirConcepts: Record<string, ConceptNode[]> = JSON.parse(JSON.stringify(INITIAL_CONCEPTS));
    kabirConcepts.Mathematics = kabirConcepts.Mathematics.map((c) => {
      if (c.id === 'math-1') return { ...c, masteryScore: 52, status: 'remediation' };
      return { ...c, masteryScore: 0, status: 'locked' };
    });
    return kabirConcepts;
  }

  // New or custom enrolled student: start with fresh 0% baseline
  return getCleanCurriculumConcepts();
}

/**
 * Retrieve dynamic concepts map for a specific student from localStorage,
 * or generate their default starting state if first time.
 */
export function getStudentConcepts(
  userId: string,
  studentId?: string,
  studentName?: string
): Record<string, ConceptNode[]> {
  if (!userId) {
    return getCleanCurriculumConcepts();
  }

  const storageKey = `${STUDENT_CONCEPTS_PREFIX}${userId}`;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading student concepts from storage:', err);
  }

  // Generate initial state for this student and persist
  const defaultState = getDefaultConceptsForStudent(studentId || userId, studentName);
  saveStudentConcepts(userId, defaultState);
  return defaultState;
}

/**
 * Compute overall average mastery score across all subjects and concepts
 */
export function calculateOverallMastery(conceptsMap: Record<string, ConceptNode[]>): number {
  const allNodes = Object.values(conceptsMap || {}).flat();
  if (allNodes.length === 0) return 0;
  const total = allNodes.reduce((acc, c) => acc + (c.masteryScore || 0), 0);
  return Math.round(total / allNodes.length);
}


/**
 * Cache-only helper: Synchronize successful backend concept map into localStorage
 * without re-triggering a backend PUT.
 */
export function setLocalStudentConceptsCache(userId: string, conceptsMap: Record<string, ConceptNode[]>): void {
  if (!userId) return;
  const storageKey = `${STUDENT_CONCEPTS_PREFIX}${userId}`;
  const overallMastery = calculateOverallMastery(conceptsMap);
  try {
    localStorage.setItem(storageKey, JSON.stringify(conceptsMap));
    window.dispatchEvent(
      new window.CustomEvent('learnx_student_concepts_updated', {
        detail: { userId, conceptsMap, overallMastery },
      })
    );
  } catch (err) {
    console.warn('Error cache-saving student concepts to storage:', err);
  }
}

/**
 * Save updated concepts map for a specific student and broadcast event
 * Synchronizes with both localStorage and XAMPP MySQL backend.
 */
export function saveStudentConcepts(
  userId: string,
  conceptsMap: Record<string, ConceptNode[]>,
  strugglingConcept?: string | null
): void {
  if (!userId) return;
  setLocalStudentConceptsCache(userId, conceptsMap);

  // Sync directly to XAMPP MySQL backend
  apiSaveStudentProgress(userId, {
    conceptsMap,
    overallMastery: calculateOverallMastery(conceptsMap),
    strugglingConcept: strugglingConcept ?? null,
  }).catch((err) => {
    console.warn('Background MySQL progress sync note:', err?.message);
  });
}

/**
 * Server API: Authenticate an existing user
 */
export async function apiLoginUser(params: {
  email?: string;
  password?: string;
}): Promise<any> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Login failed', { cause: data });
  }

  if (data.success && data.user && data.conceptsMap) {
    setLocalStudentConceptsCache(data.user.id, data.conceptsMap);
  }
  return data;
}

/**
 * Server API: Register a new user
 */
export async function apiRegisterUser(params: {
  email?: string;
  name?: string;
  role?: UserRole;
  grade?: string;
  interest?: StudentInterest;
  studentId?: string;
  institution?: string;
  institutionId?: string;
  institutionCode?: string;
  department?: string;
  teacherId?: string;
  password?: string;
}): Promise<any> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Registration failed');
  }

  if (data.success && data.user && data.conceptsMap) {
    setLocalStudentConceptsCache(data.user.id, data.conceptsMap);
  }
  return data;
}

/**
 * Server API: Claim an account using email and new password
 */
export async function apiClaimAccount(email: string, newPassword: string): Promise<any> {
  const res = await fetch('/api/auth/claim-password', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, newPassword }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Account claim failed');
  }
  return data;
}

/**
 * Server API: Logout current user session
 */
export async function apiLogoutUser(): Promise<boolean> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    return true;
  } catch (err) {
    console.warn('Logout request failed', err);
    return false;
  }
}
/**
 * Server API: Save student progress and curriculum state to MySQL
 */
export async function apiSaveStudentProgress(
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
    const res = await fetch(`/api/users/${userId}/progress`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const resData = await res.json();
      return !!resData.success;
    }
  } catch (err) {
    console.warn('Failed to sync progress with MySQL:', err);
  }
  return false;
}

/**
 * Server API: Update student profile in MySQL (interest theme, grade, name, streak)
 */
export async function apiUpdateUserProfile(
  userId: string,
  updates: {
    interest?: StudentInterest;
    grade?: string;
    name?: string;
    streakCount?: number;
    avatar?: string;
  }
): Promise<boolean> {
  try {
    const res = await fetch(`/api/users/${userId}/profile`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const data = await res.json();
      return !!data.success;
    }
  } catch (err) {
    console.warn('Failed to update user profile in MySQL:', err);
  }
  return false;
}

/**
 * Server API: Fetch current student progress and profile from MySQL
 */
export async function apiFetchStudentProgress(userId: string): Promise<{
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
    const res = await fetch(`/api/users/${userId}/progress`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return {
          conceptsMap: data.conceptsMap,
          overallMastery: data.overallMastery,
          strugglingConcept: data.strugglingConcept,
          status: data.status,
          interest: data.interest,
          grade: data.grade,
          streakCount: data.streakCount,
          name: data.name,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to fetch student progress from MySQL:', err);
  }
  return null;
}

/**
 * Server API: Institution direct login authentication
 */
export async function apiInstitutionLogin(codeOrEmail: string, password?: string): Promise<{
  success: boolean;
  institution?: any;
  user?: UserProfile;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/institution-login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codeOrEmail, password }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to connect to institution login' };
  }
}

/**
 * Server API: Instant verification of institution code during student signup
 */
export async function apiVerifyInstitutionCode(code: string): Promise<{
  success: boolean;
  institution?: { id: string; code: string; name: string; city?: string; state?: string; status?: string };
  error?: string;
}> {
  try {
    const res = await fetch(`/api/institutions/verify-code/${encodeURIComponent(code.trim().toUpperCase())}`);
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to verify institution code' };
  }
}



