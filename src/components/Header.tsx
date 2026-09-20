import React, { useState } from 'react';
import {
  GraduationCap,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Users,
  Info,
  Eye,
  Volume2,
  VolumeX,
  Compass,
  Flame,
  Atom,
  Binary,
  Calculator,
  Type,
  LogOut,
  ChevronDown,
  ArrowRightLeft,
  TrendingUp,
  BarChart2,
  BarChart3,
  Sun,
  Moon,
  Shield,
  AlertTriangle,
  Network,
} from 'lucide-react';
import { StudentInterest, UserProfile, UserRole, FontTheme, AppTab } from '../types';

interface HeaderProps {
  currentSubject: string;
  onSelectSubject: (subject: string) => void;
  allSubjects: readonly string[];
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  interest: StudentInterest;
  onChangeInterest: (interest: StudentInterest) => void;
  // Accessibility props
  fontSizeMultiplier: number;
  onAdjustFontSize: (delta: number) => void;
  onResetFontSize?: () => void;
  isDyslexicFont: boolean;
  onToggleDyslexicFont: () => void;
  isHighContrast: boolean;
  onToggleHighContrast: () => void;
  ttsEnabled: boolean;
  onToggleTTS: () => void;
  streakCount: number;
  // Dark mode props
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  // Font & Auth props
  fontTheme: FontTheme;
  onChangeFontTheme: (theme: FontTheme) => void;
  currentUser: UserProfile | null;
  onOpenAuth: (role?: UserRole) => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSubject,
  onSelectSubject,
  allSubjects,
  activeTab,
  onSelectTab,
  interest,
  onChangeInterest,
  fontSizeMultiplier,
  onAdjustFontSize,
  onResetFontSize,
  isDyslexicFont,
  onToggleDyslexicFont,
  isHighContrast,
  onToggleHighContrast,
  ttsEnabled,
  onToggleTTS,
  streakCount,
  isDarkMode,
  onToggleDarkMode,
  fontTheme,
  onChangeFontTheme,
  currentUser,
  onOpenAuth,
  onLogout,
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const interests: StudentInterest[] = [
    'Cricket & Sports',
    'Gaming & Sci-Fi',
    'Music & Creative Arts',
    'Space & Astronomy',
    'Robotics & Coding',
  ];

  const isVerifiedTeacher = Boolean(
    currentUser && currentUser.role === 'teacher'
  );
  const isAdmin = Boolean(
    currentUser && currentUser.role === 'admin'
  );

  const getSubjectIcon = (subj: string) => {
    switch (subj) {
      case 'Physics':
        return <Atom className="w-3.5 h-3.5" />;
      case 'Computer Science':
        return <Binary className="w-3.5 h-3.5" />;
      case 'Mathematics':
      default:
        return <Calculator className="w-3.5 h-3.5" />;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FCFCFB]/95 backdrop-blur-md border-b border-stone-200/80 transition-all">
      {/* Top Quiet Utility & Accessibility Bar */}
      <div className="border-b border-stone-200/60 text-xs px-4 sm:px-6 py-1.5 flex items-center justify-end gap-3 bg-stone-100/60">
        {/* Right: Font Selector & Accessibility Controls */}
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {/* Active Font Family Switcher */}
          <div className="flex items-center bg-white rounded-lg px-2 py-1 border border-stone-200 text-stone-700 shadow-2xs text-[11px]">
            <Type className="w-3 h-3 text-stone-400 mr-1.5" />
            <span className="text-stone-400 mr-1 hidden sm:inline">Font:</span>
            <select
              id="select-font-theme"
              value={fontTheme}
              onChange={(e) => onChangeFontTheme(e.target.value as FontTheme)}
              className="bg-transparent font-medium text-stone-900 focus:outline-none cursor-pointer pr-1"
              title="Change active font style"
            >
              <option value="outfit">Outfit (Modern)</option>
              <option value="jakarta">Plus Jakarta (Clean)</option>
              <option value="newsreader">Newsreader (Editorial)</option>
              <option value="lexend">Lexend (Dyslexic)</option>
            </select>
          </div>

          {/* Text Size Stepper (Smooth Zoom In & Out) */}
          <div className="flex items-center bg-white rounded-lg p-0.5 border border-stone-200 text-stone-700 shadow-2xs" title="Adjust text size and zoom (scales all elements smoothly)">
            <button
              id="btn-font-dec"
              onClick={() => onAdjustFontSize(-0.1)}
              title="Zoom out / Decrease font and UI scale (A-)"
              className="px-2 py-0.5 hover:bg-stone-100 active:bg-stone-200 text-stone-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
            >
              A-
            </button>
            <button
              onClick={() => (onResetFontSize ? onResetFontSize() : onAdjustFontSize(1.0 - fontSizeMultiplier))}
              title="Click to reset zoom to 100%"
              className="px-1.5 text-[11px] font-mono font-medium text-stone-600 hover:text-stone-950 hover:bg-stone-100 rounded py-0.5 transition-colors cursor-pointer"
            >
              {Math.round(fontSizeMultiplier * 100)}%
            </button>
            <button
              id="btn-font-inc"
              onClick={() => onAdjustFontSize(0.1)}
              title="Zoom in / Increase font and UI scale (A+)"
              className="px-2 py-0.5 hover:bg-stone-100 active:bg-stone-200 text-stone-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
            >
              A+
            </button>
          </div>

          {/* Dyslexia Mode */}
          <button
            id="btn-toggle-dyslexic"
            onClick={onToggleDyslexicFont}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
              isDyslexicFont
                ? 'bg-amber-100 text-amber-900 border-amber-300 font-semibold'
                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
            }`}
            title="Toggle dyslexia-friendly Lexend typography"
          >
            Dyslexia Mode: {isDyslexicFont ? 'On' : 'Off'}
          </button>

          {/* High Contrast */}
          <button
            id="btn-toggle-contrast"
            onClick={onToggleHighContrast}
            className={`p-1.5 rounded-lg border text-xs transition-all ${
              isHighContrast
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
            }`}
            title="Toggle high contrast"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {/* Voice Reader */}
          <button
            id="btn-toggle-tts"
            onClick={onToggleTTS}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
              ttsEnabled
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-white text-stone-400 border-stone-200 hover:bg-stone-50'
            }`}
            title="Toggle speech reader assistant"
          >
            {ttsEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-700" /> : <VolumeX className="w-3.5 h-3.5 text-stone-400" />}
            <span>Voice</span>
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            id="btn-toggle-dark-mode"
            onClick={onToggleDarkMode}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer shadow-2xs ${
              isDarkMode
                ? 'bg-amber-400/15 text-amber-300 border-amber-400/30 hover:bg-amber-400/25'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100 hover:text-stone-900'
            }`}
            title={isDarkMode ? 'Switch to Light Mode (Ctrl+D)' : 'Switch to Dark Mode (Ctrl+D)'}
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-stone-600" />
                <span>Dark</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main App Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#114B43] text-white flex items-center justify-center shadow-xs">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold tracking-tight text-stone-900">
                LearnX
              </h1>
              <span className="text-[10px] uppercase tracking-wider font-sans font-semibold px-2 py-0.5 bg-stone-100 text-stone-700 rounded border border-stone-200/80">
                Learning
              </span>
            </div>
            <p className="text-[11px] text-stone-500 hidden sm:block">
              Personalized learning for every student
            </p>
          </div>
        </div>

        {/* Center: Curriculum Subject Selector & Student Interest */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Subject Switcher Segmented Control */}
          <div className="flex items-center bg-stone-100/90 p-1 rounded-xl border border-stone-200/70">
            {allSubjects.map((subj) => {
              const isSelected = currentSubject === subj;
              return (
                <button
                  key={subj}
                  id={`btn-subject-${subj.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => onSelectSubject(subj)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${
                    isSelected
                      ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 font-normal'
                  }`}
                >
                  {getSubjectIcon(subj)}
                  <span>{subj}</span>
                </button>
              );
            })}
          </div>

          {/* Interest Selector for Students or Faculty Department for Teachers */}
          {!isVerifiedTeacher ? (
            <div className="relative flex items-center gap-1.5 bg-white border border-stone-200 text-stone-800 px-3 py-1.5 rounded-xl text-xs font-medium shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <span className="text-stone-500 text-[11px] hidden sm:inline">Theme:</span>
              <select
                id="select-student-interest"
                value={interest}
                onChange={(e) => onChangeInterest(e.target.value as StudentInterest)}
                className="bg-transparent font-medium text-xs text-stone-900 focus:outline-none cursor-pointer pr-1"
                title="Change interest to adapt curriculum analogies"
              >
                {interests.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-950 px-3 py-1.5 rounded-xl text-xs font-medium shadow-2xs">
              <Shield className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="font-semibold">
                {currentUser?.department || 'Department of STEM & Sciences'}
              </span>
              {currentUser?.institution && (
                <span className="text-[11px] text-emerald-700 hidden lg:inline">
                  • {currentUser.institution}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Faculty Badge & User Auth Profile */}
        <div className="flex items-center gap-2.5">
          {currentUser?.role === 'student' && streakCount > 0 && (
            <div
              className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 px-2.5 py-1.5 rounded-xl text-xs font-semibold shadow-2xs"
              title={`${streakCount} day learning streak`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>{streakCount}d streak</span>
            </div>
          )}

          {isVerifiedTeacher && (
            <div
              className="flex items-center gap-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-mono font-medium shadow-2xs"
              title="Verified Educator Faculty ID"
            >
              <Users className="w-3.5 h-3.5 text-emerald-700" />
              <span>Faculty ID: {currentUser?.teacherId || 'FAC-2026-101'}</span>
            </div>
          )}

          {isAdmin && (
            <div
              className="flex items-center gap-1.5 bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs font-mono font-medium shadow-2xs"
              title="Verified System Administrator"
            >
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              <span>Super Admin</span>
            </div>
          )}

          {/* User Profile / Sign In Interface */}
          {currentUser ? (
            <div className="relative">
              <button
                id="btn-user-profile-menu"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 p-1 pl-2 pr-2.5 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl text-xs transition-colors shadow-2xs"
              >
                <div className={`w-6 h-6 rounded-full text-white flex items-center justify-center font-bold text-[10px] ${
                  isAdmin ? 'bg-amber-600' : 'bg-[#114B43]'
                }`}>
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="font-semibold text-stone-900 leading-tight text-xs max-w-[110px] truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-stone-500 capitalize">
                    {currentUser.role === 'admin' ? 'Administrator' : currentUser.role === 'teacher' ? 'Educator' : 'Student'}
                  </div>
                </div>
                <ChevronDown className="w-3 h-3 text-stone-400" />
              </button>

              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-stone-200 rounded-xl shadow-lg p-2 text-xs z-50 animate-in fade-in">
                  <div className="px-3 py-2 border-b border-stone-100 mb-1">
                    <p className="font-semibold text-stone-900 truncate">{currentUser.name}</p>
                    <p className="text-[11px] text-stone-400 truncate">{currentUser.email}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded capitalize ${
                        isAdmin ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-700'
                      }`}>
                        {currentUser.role === 'admin' ? 'Administrator' : currentUser.role === 'teacher' ? 'Educator Account' : 'Student Account'}
                      </span>
                      {currentUser.role === 'teacher' && currentUser.teacherId && (
                        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {currentUser.teacherId}
                        </span>
                      )}
                    </div>
                  </div>

                  {currentUser.role === 'admin' ? (
                    <>
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          onSelectTab('admin');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-100 flex items-center gap-2 text-stone-700 font-medium cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5 text-amber-600" />
                        <span>Admin Control Room</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          onSelectTab('teacher');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-100 flex items-center gap-2 text-stone-700 font-medium cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Preview Faculty View</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          onSelectTab('path');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-100 flex items-center gap-2 text-stone-700 font-medium cursor-pointer"
                      >
                        <GraduationCap className="w-3.5 h-3.5 text-[#114B43]" />
                        <span>Preview Student View</span>
                      </button>
                    </>
                  ) : currentUser.role === 'teacher' ? (
                    <>
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          onSelectTab('path');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-100 flex items-center gap-2 text-stone-700 font-medium cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-stone-500" />
                        <span>Switch to Student View</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          onSelectTab('admin');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-100 flex items-center gap-2 text-stone-700 font-medium cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5 text-amber-600" />
                        <span>Admin Control Room</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          onOpenAuth('teacher');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-100 flex items-center gap-2 text-stone-700 font-medium cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Educator Login (Faculty ID)</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          onSelectTab('admin');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-100 flex items-center gap-2 text-stone-700 font-medium cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5 text-amber-600" />
                        <span>Admin Control Room</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => {
                      onToggleDarkMode();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-100 flex items-center justify-between text-stone-700 font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-stone-500" />}
                      <span>{isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
                    </div>
                    <span className="text-[10px] text-stone-400 font-mono">Ctrl+D</span>
                  </button>

                  <button
                    id="btn-logout"
                    onClick={() => {
                      setIsProfileOpen(false);
                      onLogout();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-50 text-rose-700 flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                id="btn-student-signin"
                onClick={() => onOpenAuth('student')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-medium text-stone-800 shadow-2xs transition-all cursor-pointer"
                title="Sign in or register as a student"
              >
                <GraduationCap className="w-3.5 h-3.5 text-[#114B43]" />
                <span className="hidden sm:inline">Student</span> Sign In
              </button>

              <button
                id="btn-teacher-signin"
                onClick={() => onOpenAuth('teacher')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-xs font-medium text-white shadow-2xs transition-all cursor-pointer"
                title="Sign in or register as an educator"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Teacher</span> Sign In
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs - Role-Based Partition */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-2 border-t border-stone-200/50 py-1.5 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5">
          {isAdmin ? (
            /* ================= ADMIN NAVIGATION TABS ================= */
            <>
              <div className="flex items-center gap-1.5 mr-1 pl-0.5 border-r border-stone-200/80 pr-2.5">
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-600 text-white flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5" />
                  <span>Admin Room</span>
                </span>
              </div>

              <button
                id="nav-tab-admin-hub"
                onClick={() => onSelectTab('admin')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-[#114B43] text-white shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Control Room & CRM</span>
              </button>

              <button
                id="nav-tab-admin-preview-teacher"
                onClick={() => onSelectTab('teacher')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'teacher'
                    ? 'bg-stone-800 text-white font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>Preview Faculty View</span>
              </button>

              <button
                id="nav-tab-admin-preview-student"
                onClick={() => onSelectTab('path')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'path'
                    ? 'bg-stone-800 text-white font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-[#114B43]" />
                <span>Preview Student View</span>
              </button>
            </>
          ) : isVerifiedTeacher ? (
            /* ================= EDUCATOR NAVIGATION TABS ================= */
            <>
              <div className="flex items-center gap-1.5 mr-1 pl-0.5 border-r border-stone-200/80 pr-2.5">
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#114B43] text-white flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5" />
                  <span>Faculty View</span>
                </span>
              </div>

              <button
                id="nav-tab-teacher-cohort"
                onClick={() => onSelectTab('teacher')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'teacher'
                    ? 'bg-[#114B43] text-white shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Classroom Overview</span>
              </button>

              <button
                id="nav-tab-teacher-roster"
                onClick={() => onSelectTab('teacher-roster')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'teacher-roster'
                    ? 'bg-[#114B43] text-white shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Student Roster & Profiles</span>
              </button>

              <button
                id="nav-tab-teacher-interventions"
                onClick={() => onSelectTab('teacher-interventions')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'teacher-interventions'
                    ? 'bg-[#114B43] text-white shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Help Topics & Action Plans</span>
              </button>

              <button
                id="nav-tab-teacher-curriculum"
                onClick={() => onSelectTab('teacher-curriculum')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'teacher-curriculum'
                    ? 'bg-[#114B43] text-white shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>Curriculum Knowledge Map</span>
              </button>
            </>
          ) : (
            /* ================= STUDENT NAVIGATION TABS ================= */
            <>
              <button
                id="nav-tab-path"
                onClick={() => onSelectTab('path')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'path'
                    ? 'bg-[#114B43] text-white shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Knowledge Graph</span>
              </button>

              <button
                id="nav-tab-lesson"
                onClick={() => onSelectTab('lesson')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'lesson'
                    ? 'bg-[#114B43] text-white shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Micro-Lesson</span>
              </button>

              <button
                id="nav-tab-assessment"
                onClick={() => onSelectTab('assessment')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'assessment'
                    ? 'bg-[#114B43] text-white shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mastery Check</span>
              </button>

              <button
                id="nav-tab-progress"
                onClick={() => onSelectTab('progress')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'progress'
                    ? 'bg-[#114B43] text-white shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>My Growth Analytics</span>
              </button>

              <button
                id="nav-tab-tutor"
                onClick={() => onSelectTab('tutor')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'tutor'
                    ? 'bg-[#114B43] text-white shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Study Mentor</span>
              </button>
            </>
          )}
        </div>

        {/* Global Admin Portal Quick Access */}
        {!isAdmin && (
          <button
            id="btn-nav-admin-portal"
            onClick={() => onSelectTab('admin')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border shrink-0 ${
              activeTab === 'admin'
                ? 'bg-stone-900 text-white border-stone-900 shadow-2xs font-semibold'
                : 'text-stone-500 hover:text-stone-900 border-stone-200/80 hover:bg-stone-100/80'
            }`}
            title="Administrator Control Room & Model Configuration"
          >
            <Shield className="w-3 h-3 text-amber-600" />
            <span>Admin Portal</span>
          </button>
        )}
      </div>
    </header>
  );
};
