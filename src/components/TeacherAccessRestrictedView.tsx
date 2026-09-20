import React from 'react';
import {
  ShieldAlert,
  Lock,
  GraduationCap,
  Users,
  ArrowRight,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { UserProfile } from '../types';

interface TeacherAccessRestrictedViewProps {
  currentUser: UserProfile | null;
  onOpenTeacherAuth: () => void;
  onQuickDemoTeacher: (name: string, institution: string, department: string) => void;
  onBackToStudent: () => void;
}

export const TeacherAccessRestrictedView: React.FC<TeacherAccessRestrictedViewProps> = ({
  currentUser,
  onOpenTeacherAuth,
  onQuickDemoTeacher,
  onBackToStudent,
}) => {
  const isStudent = currentUser?.role === 'student';

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden animate-in fade-in duration-200">
        {/* Top Banner */}
        <div className="p-8 sm:p-10 border-b border-stone-100 bg-stone-50/70 text-center relative overflow-hidden">
          {/* Subtle background lock icon watermark */}
          <div className="absolute -right-8 -bottom-8 text-stone-200/40 pointer-events-none">
            <Lock className="w-56 h-56" />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs font-semibold mb-4">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Teacher ID Verification Required</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 tracking-tight">
            Institutional Educator & Faculty Portal
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 max-w-xl mx-auto mt-2 leading-relaxed">
            The Classroom Roster, Student Mastery Analytics, and Practice Assignment Tools are reserved for educators with an authorized <strong>Teacher ID</strong>.
          </p>
        </div>

        <div className="p-6 sm:p-10 space-y-8">
          {/* Current Session State Alert */}
          {isStudent ? (
            <div className="p-4.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3.5 text-xs text-amber-900">
              <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-stone-900 text-sm">
                  Active Session: Student Account ({currentUser.name})
                </div>
                <p className="mt-1 text-stone-600 leading-relaxed">
                  You are currently authenticated as a student learner (ID: <span className="font-mono font-medium text-stone-900">{currentUser.studentId || 'STU-2026-1048'}</span>, {currentUser.grade || 'Grade 10'}). Student accounts are restricted from accessing peer mastery metrics, classroom interventions, and cohort records.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4.5 rounded-xl bg-stone-100/70 border border-stone-200 flex items-start gap-3.5 text-xs text-stone-700">
              <KeyRound className="w-5 h-5 text-stone-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-stone-900 text-sm">
                  Authentication Required
                </div>
                <p className="mt-1 text-stone-600 leading-relaxed">
                  Please authenticate with your institutional Teacher ID (e.g. <span className="font-mono font-semibold text-stone-800">FAC-2026-xxx</span>) or sign in with your faculty email address to unlock cohort management.
                </p>
              </div>
            </div>
          )}

          {/* Action Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary Action: Sign In with Teacher ID */}
            <div className="p-6 rounded-xl border border-stone-200 bg-stone-50/50 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[#114B43] text-white flex items-center justify-center shadow-xs">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-display font-semibold text-stone-900 text-base">
                  Sign In with Teacher ID
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Enter your registered institutional credentials, department, and faculty roll ID to access your live classroom cohort.
                </p>
              </div>

              <button
                id="btn-restricted-signin-teacher"
                onClick={onOpenTeacherAuth}
                className="w-full py-2.5 px-4 bg-[#114B43] hover:bg-[#0c3832] text-white rounded-xl text-xs font-semibold transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Sign In / Register as Teacher</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Evaluation / Quick Demo Teacher Action */}
            <div className="p-6 rounded-xl border border-emerald-200/80 bg-emerald-50/30 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="font-display font-semibold text-stone-900 text-base">
                  Verified Faculty Access
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Need faculty access? Sign in with an educator account or switch to verified faculty profile for <strong className="text-emerald-950">Dr. Priya Rao</strong> (Teacher ID: <span className="font-mono font-semibold">FAC-2026-101</span>).
                </p>
              </div>

              <button
                id="btn-restricted-demo-teacher"
                onClick={() =>
                  onQuickDemoTeacher('Dr. Priya Rao', 'Kendriya Vidyalaya Academy', 'Mathematics & STEM')
                }
                className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Switch to Faculty: Dr. Priya Rao</span>
              </button>
            </div>
          </div>

          {/* Teacher Portal Features Overview */}
          <div className="pt-4 border-t border-stone-200/70">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-stone-500 mb-3">
              Protected Faculty Tools & Features
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-stone-600">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-stone-50 border border-stone-200/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Classroom Mastery Distribution & Progress</span>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-stone-50 border border-stone-200/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Topic Hurdle Alerts & Recommended Practice</span>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-stone-50 border border-stone-200/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Student Roster Management & CSV Export</span>
              </div>
            </div>
          </div>

          {/* Return button */}
          <div className="text-center pt-2">
            <button
              id="btn-restricted-back-student"
              onClick={onBackToStudent}
              className="inline-flex items-center gap-2 text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-stone-100"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Student Course Map</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
