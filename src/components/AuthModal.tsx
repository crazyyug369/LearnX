import React, { useState } from 'react';
import {
  X,
  GraduationCap,
  Users,
  Lock,
  Mail,
  User,
  School,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  BookOpen,
  Shield,
  Building2,
  Loader2,
  Check,
} from 'lucide-react';
import { UserProfile, UserRole, StudentInterest, ConceptNode } from '../types';
import { registerStudentInCohort, apiLoginUser, apiRegisterUser, apiClaimAccount, apiVerifyInstitutionCode, apiInstitutionLogin } from '../utils/studentStorage';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: UserProfile, conceptsMap?: Record<string, ConceptNode[]>, isNew?: boolean) => void;
  initialRole?: UserRole;
  initialMessage?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  initialRole = 'student',
  initialMessage,
}) => {
  const [activeRole, setActiveRole] = useState<UserRole>(initialRole);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'claim_account'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(initialMessage || null);

  const modalRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setAuthError(initialMessage || null);
      // Minimal accessible focus behavior
      setTimeout(() => {
        modalRef.current?.focus();
      }, 0);
    }
  }, [isOpen, initialMessage]);

  // Student Form State
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentGrade, setStudentGrade] = useState('Class 10');
  const [studentInterest, setStudentInterest] = useState<StudentInterest>('Cricket & Sports');
  const [studentInstCode, setStudentInstCode] = useState('');
  const [verifyingInstCode, setVerifyingInstCode] = useState(false);
  const [verifiedInst, setVerifiedInst] = useState<{ id: string; code: string; name: string; city?: string } | null>(null);
  const [instCodeError, setInstCodeError] = useState<string | null>(null);

  // Teacher Form State
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [teacherFacultyId, setTeacherFacultyId] = useState(`FAC-2026-${Math.floor(100 + Math.random() * 900)}`);
  const [teacherInstitution, setTeacherInstitution] = useState('');
  const [teacherDept, setTeacherDept] = useState('Mathematics');

  // Institution Form State
  const [instLoginTerm, setInstLoginTerm] = useState('DPS2026');
  const [instLoginPassword, setInstLoginPassword] = useState('learnx@123');
  const [instLoginError, setInstLoginError] = useState<string | null>(null);

  // Admin Form State
  const [adminEmail, setAdminEmail] = useState('admin@learnx.org');
  const [adminPassword, setAdminPassword] = useState('');

  if (!isOpen) return null;

  const interestsList: StudentInterest[] = [
    'Cricket & Sports',
    'Gaming & Sci-Fi',
    'Music & Creative Arts',
    'Space & Astronomy',
    'Robotics & Coding',
  ];

  // Quick 1-Click Demo Profiles (connected directly to MySQL)
  const handleQuickDemoStudent = async (name: string, interest: StudentInterest, grade: string) => {
    setIsSubmitting(true);
    try {
      const email = `${name.toLowerCase().replace(/\s+/g, '.')}@student.learnx.org`;
      await apiLoginUser({ email, password: 'password123' });
      const verifiedUser = await refreshUserSession();
      if (verifiedUser.role === 'student') registerStudentInCohort(verifiedUser);
      onLogin(verifiedUser);
      onClose();
    } catch (err) {
      console.warn('Login error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoTeacher = async (name: string, institution: string, department: string, teacherId: string) => {
    setIsSubmitting(true);
    try {
      const email = `${name.toLowerCase().replace(/[^a-z]/g, '.')}@${institution.toLowerCase().replace(/[^a-z]/g, '')}.edu.in`;
      await apiLoginUser({ email, password: 'password123' });
      const verifiedUser = await refreshUserSession();
      onLogin(verifiedUser);
      onClose();
    } catch (err) {
      console.warn('Teacher login error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    setStudentInstCode(trimmed);
    if (!trimmed) {
      setVerifiedInst(null);
      setInstCodeError(null);
      return;
    }
    setVerifyingInstCode(true);
    setInstCodeError(null);
    try {
      const res = await apiVerifyInstitutionCode(trimmed);
      if (res.success && res.institution) {
        setVerifiedInst(res.institution);
        setInstCodeError(null);
      } else {
        setVerifiedInst(null);
        setInstCodeError(res.error || 'Institution code not found');
      }
    } catch {
      setVerifiedInst(null);
      setInstCodeError('Could not verify code');
    } finally {
      setVerifyingInstCode(false);
    }
  };

    const refreshUserSession = async () => {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) throw new Error('API Request Failed');
    const data = await res.json();
    if (!data.success || !data.user) throw new Error('Session invalid after auth');
    return data.user;
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const cleanEmail = studentEmail.trim().toLowerCase();
      const cleanName = studentName.trim() || studentEmail.split('@')[0] || 'Learner';

      const payload = {
        name: cleanName,
        email: cleanEmail,
        password: studentPassword,
        role: 'student' as UserRole,
        grade: studentGrade,
        interest: studentInterest,
        institution: verifiedInst ? verifiedInst.name : undefined,
        institutionId: verifiedInst ? verifiedInst.id : undefined,
        institutionCode: verifiedInst ? verifiedInst.code : studentInstCode.trim() ? studentInstCode.trim().toUpperCase() : undefined,
      };

      let res;
      if (authMode === 'signup') {
        res = await apiRegisterUser(payload);
      } else {
        res = await apiLoginUser({ email: cleanEmail, password: studentPassword });
      }

      const verifiedUser = await refreshUserSession();
      if (verifiedUser.role === 'student') {
        registerStudentInCohort(verifiedUser);
      }
      
      const isNewStudent = Boolean(res.isNew || authMode === 'signup' || verifiedUser.isNew || !verifiedUser.diagnosticCompleted);
      onLogin(verifiedUser, res?.conceptsMap, isNewStudent);
      onClose();
    } catch (err: any) {
      if (err.cause?.needsClaim) {
        setAuthMode('claim_account');
        setAuthError('Your account needs a secure password. Please claim your account.');
      } else {
        setAuthError(err.message || 'Authentication failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const assignedId = teacherFacultyId.trim() || `FAC-2026-${Math.floor(100 + Math.random() * 900)}`;
      const cleanName = teacherName.trim() || (teacherEmail ? `Prof. ${teacherEmail.split("@")[0]}` : "Faculty Member");

      const payload = {
        name: cleanName,
        email: teacherEmail.trim(),
        password: teacherPassword,
        role: 'teacher' as UserRole,
        institution: verifiedInst ? verifiedInst.name : teacherInstitution.trim() || 'Kendriya Vidyalaya Academy',
        institutionId: verifiedInst ? verifiedInst.id : undefined,
        institutionCode: verifiedInst ? verifiedInst.code : undefined,
        department: teacherDept,
        teacherId: assignedId,
      };

      if (authMode === 'signup') {
        await apiRegisterUser(payload);
      } else {
        await apiLoginUser({ email: teacherEmail.trim(), password: teacherPassword });
      }

      const verifiedUser = await refreshUserSession();
      onLogin(verifiedUser);
      onClose();
    } catch (err: any) {
      if (err.cause?.needsClaim) {
        setAuthMode('claim_account');
        setAuthError('Your account needs a secure password. Please claim your account.');
      } else {
        setAuthError(err.message || 'Authentication failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const email = activeRole === 'student' ? studentEmail : teacherEmail;
      const pw = activeRole === 'student' ? studentPassword : teacherPassword;
      await apiClaimAccount(email, pw);
      
      // After claim, log them in
      await apiLoginUser({ email, password: pw });
      const verifiedUser = await refreshUserSession();
      onLogin(verifiedUser);
      onClose();
    } catch (err: any) {
      setAuthError(err.message || 'Failed to claim account');
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleInstitutionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setInstLoginError(null);
    try {
      await apiInstitutionLogin(instLoginTerm.trim(), instLoginPassword.trim());
      const verifiedUser = await refreshUserSession();
      onLogin(verifiedUser);
      onClose();
    } catch (err: any) {
      setInstLoginError(err?.message || 'Failed to authenticate institution');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoInstitution = async (code: string, name: string) => {
    setIsSubmitting(true);
    setInstLoginError(null);
    try {
      await apiInstitutionLogin(code, 'learnx@123');
      const verifiedUser = await refreshUserSession();
      onLogin(verifiedUser);
      onClose();
    } catch (err: any) {
      setInstLoginError(err?.message || 'Failed to authenticate institution');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const email = adminEmail.trim() || 'admin@learnx.org';
      await apiLoginUser({ email, password: adminPassword });
      const verifiedUser = await refreshUserSession();
      onLogin(verifiedUser);
      onClose();
    } catch (err) {
      console.warn('Admin auth error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="bg-white rounded-2xl border border-stone-200/90 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in duration-200 my-8 outline-none"
      >
        {/* Top Header */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded bg-stone-200 text-stone-700 uppercase tracking-wider">
                Authentication Portal
              </span>
              <span className="text-xs text-stone-400 font-sans">• Learning Platform</span>
            </div>
            <h3 id="auth-modal-title" className="text-xl font-display font-semibold text-stone-900 mt-1">
              Welcome to LearnX
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Select your role to access your personalized learning path or educator dashboard
            </p>
          </div>
          <button
            id="btn-close-auth-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role Switcher Tabs */}
        <div className="p-6 pb-2">
          <div className="grid grid-cols-4 gap-1 p-1 bg-stone-100/90 rounded-xl border border-stone-200/70">
            <button
              id="tab-auth-student"
              type="button"
              onClick={() => setActiveRole('student')}
              className={`py-2 px-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                activeRole === 'student'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <GraduationCap className={`w-3.5 h-3.5 ${activeRole === 'student' ? 'text-[#114B43]' : 'text-stone-400'}`} />
              <span className="truncate">Student</span>
            </button>

            <button
              id="tab-auth-teacher"
              type="button"
              onClick={() => setActiveRole('teacher')}
              className={`py-2 px-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                activeRole === 'teacher'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Users className={`w-3.5 h-3.5 ${activeRole === 'teacher' ? 'text-[#114B43]' : 'text-stone-400'}`} />
              <span className="truncate">Educator</span>
            </button>

            <button
              id="tab-auth-institution"
              type="button"
              onClick={() => setActiveRole('institution')}
              className={`py-2 px-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                activeRole === 'institution'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Building2 className={`w-3.5 h-3.5 ${activeRole === 'institution' ? 'text-[#114B43]' : 'text-stone-400'}`} />
              <span className="truncate">Institution</span>
            </button>

            <button
              id="tab-auth-admin"
              type="button"
              onClick={() => setActiveRole('admin')}
              className={`py-2 px-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                activeRole === 'admin'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Shield className={`w-3.5 h-3.5 ${activeRole === 'admin' ? 'text-[#114B43]' : 'text-stone-400'}`} />
              <span className="truncate">Admin</span>
            </button>
          </div>

          {/* Sub Switch: Sign In vs Sign Up */}
          <div className="flex items-center justify-between mt-4 pb-2 border-b border-stone-100 text-xs">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setAuthMode('signin')}
                className={`pb-1.5 border-b-2 font-medium transition-all ${
                  authMode === 'signin'
                    ? 'border-stone-900 text-stone-900 font-semibold'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Sign In
              </button>
              {activeRole !== 'admin' && activeRole !== 'institution' && (
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`pb-1.5 border-b-2 font-medium transition-all ${
                    authMode === 'signup'
                      ? 'border-stone-900 text-stone-900 font-semibold'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {activeRole === 'student' ? 'Create Student Account' : 'Register Faculty Account'}
                </button>
              )}
            </div>
            <span className="text-[11px] text-stone-400 hidden sm:inline">
              Role: <strong className="capitalize text-stone-700">{activeRole}</strong>
            </span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 pt-3 space-y-5">

          {authError && (
            <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <span className="font-medium">{authError}</span>
            </div>
          )}


          {/* Claim Account Form */}
          {authMode === 'claim_account' && (
            <form onSubmit={handleClaimAccountSubmit} className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Security Update Required</div>
                  <div className="text-[11px] text-amber-800 mt-0.5">
                    Your account needs a secure password before you can continue. Please set one now.
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="input-claim-password" className="block text-xs font-medium text-stone-700 mb-1">
                  Set New Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3" />
                  <input
                    id="input-claim-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={activeRole === 'student' ? studentPassword : teacherPassword}
                    onChange={(e) => activeRole === 'student' ? setStudentPassword(e.target.value) : setTeacherPassword(e.target.value)}
                    placeholder="Enter a strong password"
                    className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-stone-400 hover:text-stone-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="btn-submit-claim-account"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{isSubmitting ? 'Securing...' : 'Secure My Account'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}



          {/* Student Form */}
          {activeRole === 'student' && authMode !== 'claim_account' && (
            <form onSubmit={handleStudentSubmit} className="space-y-3.5">
              {authMode === 'signup' && (
                <div>
                  <label htmlFor="input-student-name" className="block text-xs font-medium text-stone-700 mb-1">
                    Student Full Name
                  </label>
                  <div className="relative flex items-center">
                    <User className="w-4 h-4 text-stone-400 absolute left-3" />
                    <input
                      id="input-student-name"
                      type="text"
                      required={authMode === 'signup'}
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="e.g. Aarav Sharma"
                      className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="input-student-email" className="block text-xs font-medium text-stone-700 mb-1">
                  Student Email or Roll ID
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3" />
                  <input
                    id="input-student-email"
                    type="text"
                    required
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    placeholder="student@school.edu or roll number"
                    className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="input-student-password" className="block text-xs font-medium text-stone-700 mb-1">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3" />
                  <input
                    id="input-student-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-stone-400 hover:text-stone-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {authMode === 'signup' && (
                <>
                  {/* Institute Code Allocation Field */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="input-student-inst-code" className="block text-xs font-medium text-stone-700">
                        Institute / School Code <span className="text-stone-400 font-normal">(Optional)</span>
                      </label>
                      <span className="text-[10px] text-stone-400 font-mono">e.g. DPS2026, KVA2026</span>
                    </div>
                    <div className="relative flex items-center">
                      <School className="w-4 h-4 text-stone-400 absolute left-3" />
                      <input
                        id="input-student-inst-code"
                        type="text"
                        value={studentInstCode}
                        onChange={(e) => handleVerifyCode(e.target.value)}
                        placeholder="Enter your school code"
                        className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 uppercase font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-stone-400"
                      />
                      {verifyingInstCode && (
                        <Loader2 className="w-4 h-4 text-[#114B43] animate-spin absolute right-3" />
                      )}
                      {!verifyingInstCode && verifiedInst && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute right-3" />
                      )}
                    </div>

                    {verifiedInst && (
                      <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-[11px] text-emerald-800 animate-in fade-in duration-150">
                        <span className="font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Allocated to: <strong>{verifiedInst.name}</strong> {verifiedInst.city ? `(${verifiedInst.city})` : ''}
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 bg-emerald-100 rounded text-emerald-900 font-bold">{verifiedInst.code}</span>
                      </div>
                    )}
                    {instCodeError && (
                      <div className="mt-1 text-[11px] text-amber-750 flex items-center gap-1">
                        <span>Notice: {instCodeError}. Leave blank to enroll in general public cohort.</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label htmlFor="select-student-grade" className="block text-xs font-medium text-stone-700 mb-1">
                        Class / Grade Level
                      </label>
                      <select
                        id="select-student-grade"
                        value={studentGrade}
                        onChange={(e) => setStudentGrade(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400 cursor-pointer font-medium"
                      >
                        <option value="Class 6">Class 6 (Middle School)</option>
                        <option value="Class 7">Class 7 (Middle School)</option>
                        <option value="Class 8">Class 8 (Middle School)</option>
                        <option value="Class 9">Class 9 (Secondary)</option>
                        <option value="Class 10">Class 10 (Secondary Board)</option>
                        <option value="Class 11">Class 11 (Senior Secondary)</option>
                        <option value="Class 12">Class 12 (Board & Competitive)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="select-signup-interest" className="block text-xs font-medium text-stone-700 mb-1">
                        Curriculum Interest
                      </label>
                      <select
                        id="select-signup-interest"
                        value={studentInterest}
                        onChange={(e) => setStudentInterest(e.target.value as StudentInterest)}
                        className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400 cursor-pointer"
                      >
                        {interestsList.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Mandatory Baseline Diagnostic Notice */}
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-start gap-2 text-[11px] text-emerald-900">
                    <Sparkles className="w-3.5 h-3.5 text-[#114B43] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Mandatory Prerequisite Calibration:</span> Upon registering, a multi-tier diagnostic test across {studentGrade} chapters will automatically launch to calibrate your Knowledge Graph.
                    </div>
                  </div>
                </>
              )}

              <div className="pt-2">
                <button
                  id="btn-submit-student-auth"
                  type="submit"
                  className="w-full py-2.5 px-4 bg-[#114B43] hover:bg-[#0D3F38] text-white rounded-lg text-xs font-medium transition-all shadow-2xs flex items-center justify-center gap-2"
                >
                  <span>{authMode === 'signin' ? 'Sign In as Student' : 'Create & Launch Student Journey'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* Teacher Form */}
          {activeRole === 'teacher' && authMode !== 'claim_account' && (
            <form onSubmit={handleTeacherSubmit} className="space-y-3.5">
              {authMode === 'signup' && (
                <div>
                  <label htmlFor="input-teacher-name" className="block text-xs font-medium text-stone-700 mb-1">
                    Faculty Full Name & Title
                  </label>
                  <div className="relative flex items-center">
                    <User className="w-4 h-4 text-stone-400 absolute left-3" />
                    <input
                      id="input-teacher-name"
                      type="text"
                      required={authMode === 'signup'}
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      placeholder="e.g. Dr. Priya Rao"
                      className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="input-teacher-faculty-id" className="block text-xs font-medium text-stone-700">
                    Faculty / Teacher ID
                  </label>
                  <span className="text-[10px] text-stone-400 font-mono">Format: FAC-2026-XXX</span>
                </div>
                <div className="relative flex items-center">
                  <Shield className="w-4 h-4 text-emerald-600 absolute left-3" />
                  <input
                    id="input-teacher-faculty-id"
                    type="text"
                    required
                    value={teacherFacultyId}
                    onChange={(e) => setTeacherFacultyId(e.target.value.toUpperCase())}
                    placeholder="FAC-2026-881"
                    className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 font-mono focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="input-teacher-email" className="block text-xs font-medium text-stone-700 mb-1">
                  Institutional Email
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3" />
                  <input
                    id="input-teacher-email"
                    type="text"
                    required
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                    placeholder="faculty@institution.edu.in"
                    className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="input-teacher-password" className="block text-xs font-medium text-stone-700 mb-1">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3" />
                  <input
                    id="input-teacher-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={teacherPassword}
                    onChange={(e) => setTeacherPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-stone-400 hover:text-stone-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {authMode === 'signup' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label htmlFor="input-teacher-inst" className="block text-xs font-medium text-stone-700 mb-1">
                      School / Institution
                    </label>
                    <div className="relative flex items-center">
                      <School className="w-3.5 h-3.5 text-stone-400 absolute left-2.5" />
                      <input
                        id="input-teacher-inst"
                        type="text"
                        value={teacherInstitution}
                        onChange={(e) => setTeacherInstitution(e.target.value)}
                        placeholder="e.g. Delhi Public School"
                        className="w-full pl-8 pr-2.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="select-teacher-dept" className="block text-xs font-medium text-stone-700 mb-1">
                      Department / Subject
                    </label>
                    <select
                      id="select-teacher-dept"
                      value={teacherDept}
                      onChange={(e) => setTeacherDept(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400 cursor-pointer"
                    >
                      <option value="Mathematics">Mathematics</option>
                      <option value="Physics">Physics</option>
                      <option value="Computer Science">Computer Science</option>
                      <option value="General Science">General Science</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  id="btn-submit-teacher-auth"
                  type="submit"
                  className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-all shadow-2xs flex items-center justify-center gap-2"
                >
                  <span>{authMode === 'signin' ? 'Sign In as Educator' : 'Register & Open Class Dashboard'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* Institution Portal Form */}
          {activeRole === 'institution' && (
            <form onSubmit={handleInstitutionSubmit} className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
                <Building2 className="w-4 h-4 text-[#114B43] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Institutional Multi-Tenant Portal</div>
                  <div className="text-[11px] text-emerald-800 mt-0.5">
                    Sign in with your assigned Institution Code or Admin Email to manage faculty cohorts, register students, and view school-wide analytics.
                  </div>
                </div>
              </div>

              {instLoginError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <span className="font-medium">{instLoginError}</span>
                </div>
              )}

              <div>
                <label htmlFor="input-inst-login-term" className="block text-xs font-medium text-stone-700 mb-1">
                  Institution Code or Admin Email
                </label>
                <div className="relative flex items-center">
                  <Building2 className="w-4 h-4 text-stone-400 absolute left-3" />
                  <input
                    id="input-inst-login-term"
                    type="text"
                    required
                    value={instLoginTerm}
                    onChange={(e) => setInstLoginTerm(e.target.value.toUpperCase())}
                    placeholder="e.g. DPS2026 or admin@dps.edu.in"
                    className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 font-mono focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="input-inst-login-password" className="block text-xs font-medium text-stone-700">
                    Institution Passkey
                  </label>
                  <span className="text-[10px] text-stone-400 font-mono">Demo: learnx@123</span>
                </div>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3" />
                  <input
                    id="input-inst-login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={instLoginPassword}
                    onChange={(e) => setInstLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-stone-400 hover:text-stone-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  id="btn-submit-inst-auth"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-[#114B43] hover:bg-[#0d3b34] text-white rounded-lg text-xs font-medium transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Verifying...' : 'Sign In as Institution Manager'}</span>
                </button>

                <div className="pt-1">
                  <div className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mb-1.5 text-center">
                    1-Click Demo Partner Schools
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickDemoInstitution('DPS2026', 'Delhi Public School')}
                      className="py-1.5 px-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[10px] font-medium transition-all text-center border border-stone-200 cursor-pointer"
                    >
                      DPS Delhi
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDemoInstitution('KVA2026', 'Kendriya Vidyalaya Academy')}
                      className="py-1.5 px-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[10px] font-medium transition-all text-center border border-stone-200 cursor-pointer"
                    >
                      KV Academy
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDemoInstitution('SXHS2026', "St. Xavier's High School")}
                      className="py-1.5 px-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[10px] font-medium transition-all text-center border border-stone-200 cursor-pointer"
                    >
                      St. Xavier's
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* Admin Form */}
          {activeRole === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Privileged Access Control</div>
                  <div className="text-[11px] text-amber-800 mt-0.5">
                    Administrator access permits managing platform settings, viewing CRM users, controlling the Google Gemini AI engine, and editing the global question bank.
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="input-admin-email" className="block text-xs font-medium text-stone-700 mb-1">
                  Administrator Email / Username
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3" />
                  <input
                    id="input-admin-email"
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@learnx.org"
                    className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="input-admin-password" className="block text-xs font-medium text-stone-700 mb-1">
                  Master Security Passkey
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3" />
                  <input
                    id="input-admin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="System administrator passphrase"
                    className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-stone-400 hover:text-stone-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  id="btn-submit-admin-auth"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-[#114B43] hover:bg-[#0d3b34] text-white rounded-lg text-xs font-medium transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Admin Control Room'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAdminEmail('admin@learnx.org');
                    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                    handleAdminSubmit(fakeEvent);
                  }}
                  className="w-full py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-stone-200"
                >
                  <span>Quick Demo Admin Access (admin@learnx.org)</span>
                </button>
              </div>
            </form>
          )}

          {/* Footer Guest Notice */}
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
            <span>Student & Educator accounts are isolated</span>
            <button
              id="btn-continue-guest"
              type="button"
              onClick={onClose}
              className="text-stone-600 hover:text-stone-900 font-medium underline underline-offset-2"
            >
              Continue exploring as guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};




