import React, { lazy, Suspense, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp, MessageCircle } from 'lucide-react';
import { Header } from './components/Header';
import { KnowledgeGraph } from './components/KnowledgeGraph';
import { AuthModal } from './components/AuthModal';
import { NotFoundView } from './components/NotFoundView';
import { PublicContactLinks, PublicSeoContent } from './components/PublicSeoContent';
import { PublicIntro } from './public-site/PublicIntro';
import {
  appendPublicUtmParameters,
  collectPublicUtmParameters,
  getClientPublicSiteConfig,
  getPublicSiteConfigFromData,
  parseStoredPublicUtm,
  PUBLIC_COPYRIGHT_YEAR,
  PUBLIC_UTM_STORAGE_KEY,
  type PublicAuthor,
  type PublicSiteConfig,
  type PublicUtmParams,
} from './public-site/content';
import {
  SUBJECTS,
  INITIAL_CONCEPTS,
  SAMPLE_QUESTIONS,
} from './data/curriculumData';
import {
  ConceptNode,
  StudentInterest,
  TeachingStrategy,
  MasteryBreakdown,
  UserProfile,
  UserRole,
  FontTheme,
  AppTab,
} from './types';
import {
  registerStudentInCohort,
  updateStudentMasteryInCohort,
  getStudentConcepts,
  saveStudentConcepts,
  setLocalStudentConceptsCache,
  getCleanCurriculumConcepts,
  apiFetchStudentProgress,
  apiUpdateUserProfile,
  apiLogoutUser,
  clearSensitiveClientStorage,
} from './utils/studentStorage';
import { apiFetch } from './utils/apiClient';
import {
  arePrerequisitesMastered,
  findWeakestPrerequisite,
} from './utils/adaptiveEngine';
import { updateSeoMetadata } from './utils/seo';

// Keep the initial student path small. These views are only needed after a
// user navigates away from the default knowledge graph or opens a protected
// dashboard, so load them on demand instead of shipping them in the first JS
// payload.
const LessonView = lazy(() =>
  import('./components/LessonView').then(({ LessonView: component }) => ({ default: component }))
);
const AssessmentView = lazy(() =>
  import('./components/AssessmentView').then(({ AssessmentView: component }) => ({ default: component }))
);
const StudentGrowthDashboard = lazy(() =>
  import('./components/StudentGrowthDashboard').then(({ StudentGrowthDashboard: component }) => ({ default: component }))
);
const AITutorChat = lazy(() =>
  import('./components/AITutorChat').then(({ AITutorChat: component }) => ({ default: component }))
);
const TeacherDashboard = lazy(() =>
  import('./components/TeacherDashboard').then(({ TeacherDashboard: component }) => ({ default: component }))
);
const TeacherAccessRestrictedView = lazy(() =>
  import('./components/TeacherAccessRestrictedView').then(({ TeacherAccessRestrictedView: component }) => ({ default: component }))
);
const AdminDashboard = lazy(() =>
  import('./components/admin/AdminDashboard').then(({ AdminDashboard: component }) => ({ default: component }))
);
const AdminAccessRestrictedView = lazy(() =>
  import('./components/admin/AdminAccessRestrictedView').then(({ AdminAccessRestrictedView: component }) => ({ default: component }))
);
const DiagnosticModal = lazy(() =>
  import('./components/DiagnosticModal').then(({ DiagnosticModal: component }) => ({ default: component }))
);

function DeferredViewFallback() {
  return (
    <LoadingShell label="Loading learning view..." />
  );
}

function LoadingShell({ label }: { label: string }) {
  return (
    <div className="min-h-[16rem] flex items-center justify-center gap-3 text-stone-500" role="status" aria-live="polite">
      <span className="learnx-loading-ring" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function getInitialPublicConfig(): PublicSiteConfig {
  if (typeof window === 'undefined') return {};
  if (typeof document !== 'undefined') {
    const root = document.getElementById('root');
    if (root?.dataset.learnxPublicConfig === '1') {
      return getPublicSiteConfigFromData(root.dataset);
    }
  }
  return getClientPublicSiteConfig();
}



export default function App({
  pathname = typeof window === 'undefined' ? '/' : window.location.pathname,
  publicAuthor,
  publicConfig,
}: { pathname?: string; publicAuthor?: PublicAuthor; publicConfig?: PublicSiteConfig } = {}) {
  const siteConfig = publicConfig ?? getInitialPublicConfig();
  const contact = siteConfig.contact;
  const hasContact = Boolean(contact?.email || contact?.phone || contact?.creatorUrl);
  const primaryContactHref = contact?.email
    ? `mailto:${contact.email}`
    : contact?.phone
    ? `tel:${contact.phone}`
    : contact?.creatorUrl
    ? contact.creatorUrl
    : undefined;

  // User Profile & Authentication State (Cookie-Based Session Validation)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  const [currentSubject, setCurrentSubject] = useState<string>('Mathematics');

  const [conceptsMap, setConceptsMap] = useState<Record<string, ConceptNode[]>>(
    getCleanCurriculumConcepts()
  );

  const [selectedConceptId, setSelectedConceptId] = useState<string>('math-1');

  // The server and first client render are always the same anonymous snapshot.
  // Browser preferences are restored only after hydration; server rendering
  // never reads cookies, storage, or a saved private tab.
  const [activeTab, setActiveTab] = useState<AppTab>('path');
  const [hasRestoredPreferences, setHasRestoredPreferences] = useState(false);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showConsentBanner, setShowConsentBanner] = useState(false);
  const [utmParams, setUtmParams] = useState<PublicUtmParams>({});

  const isNotFoundPath = pathname !== '/';

  useEffect(() => {
    updateSeoMetadata({ activeTab, isNotFoundPath });
  }, [isNotFoundPath]);

  useEffect(() => {
    const updateScrollState = () => {
      const documentElement = document.documentElement;
      const scrollableHeight = documentElement.scrollHeight - window.innerHeight;
      const progress = scrollableHeight > 0 ? (window.scrollY / scrollableHeight) * 100 : 0;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
      setShowBackToTop(window.scrollY > 480);
    };

    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      window.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, []);

  useEffect(() => {
    try {
      const fromQuery = collectPublicUtmParameters(window.location.search);
      const stored = Object.keys(fromQuery).length
        ? fromQuery
        : parseStoredPublicUtm(sessionStorage.getItem(PUBLIC_UTM_STORAGE_KEY));
      if (Object.keys(fromQuery).length) {
        sessionStorage.setItem(PUBLIC_UTM_STORAGE_KEY, JSON.stringify(fromQuery));
      }
      setUtmParams(stored);
    } catch {
      // Campaign attribution is optional and must never block the public shell.
      setUtmParams({});
    }
  }, []);

  useEffect(() => {
    try {
      setShowConsentBanner(localStorage.getItem('learnx_public_consent') !== 'accepted');
    } catch {
      setShowConsentBanner(true);
    }
  }, []);

  const dismissConsentBanner = () => {
    setShowConsentBanner(false);
    try {
      localStorage.setItem('learnx_public_consent', 'accepted');
    } catch {
      // The banner is still dismissed for this render when storage is blocked.
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [interest, setInterest] = useState<StudentInterest>('Cricket & Sports');

  const [strategy, setStrategy] = useState<TeachingStrategy>('Analogy & Real-world');
  const [struggleNote, setStruggleNote] = useState<string | undefined>();

  // Fetch session on startup
  useEffect(() => {
    // An anonymous 401 is the normal guest path, not a session-expiry event.
    // Keep the initial probe out of apiFetch so it does not open the auth modal
    // or emit an unnecessary auth:unauthorized event before the public shell
    // has painted.
    fetch('/api/auth/session', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Not authenticated');
        return res.json();
      })
      .then((data) => {
        if (data && data.user) {
          const user = data.user;
          setCurrentUser(user);
          if (user.role === 'admin') setActiveTab('admin');
          else if (user.role === 'teacher') setActiveTab('teacher');
          // For students, the existing useEffect (line 345 onwards) will sync concepts, interest, streak from backend
        }
      })
      .catch((err) => {
        setCurrentUser(null);
      })
      .finally(() => {
        setIsAuthLoading(false);
      });
  }, []);

  // Strict Role-Based Access Control: Roles
  const isVerifiedTeacher = Boolean(
    currentUser && currentUser.role === 'teacher'
  );
  const isAdmin = Boolean(
    currentUser && currentUser.role === 'admin'
  );

  // Enforce Strict Role-Based Access Control: Partition routes by role
  useEffect(() => {
    const teacherTabs: AppTab[] = ['teacher', 'teacher-roster', 'teacher-interventions', 'teacher-curriculum'];
    const studentTabs: AppTab[] = ['path', 'lesson', 'assessment', 'progress', 'tutor'];

    // Admin has super-privileges and can freely navigate across all views
    if (isAdmin) {
      return;
    }

    if (isVerifiedTeacher) {
      // Verified faculty cannot access student-specific views directly without role switch
      if (studentTabs.includes(activeTab)) {
        setActiveTab('teacher');
      }
    } else {
      // Non-teachers (students, guests) cannot access educator tabs
      if (teacherTabs.includes(activeTab)) {
        setActiveTab('path');
      }
    }
  }, [activeTab, isVerifiedTeacher, isAdmin]);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authInitialRole, setAuthInitialRole] = useState<UserRole>('student');

  // Font Theme & Accessibility States
  const [fontTheme, setFontTheme] = useState<FontTheme>('outfit');
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState<number>(1.0);
  const [isDyslexicFont, setIsDyslexicFont] = useState<boolean>(false);
  const [isHighContrast, setIsHighContrast] = useState<boolean>(false);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [streakCount, setStreakCount] = useState<number>(0);

  // Session expiry / permission messages
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  // Dark Mode State with LocalStorage Persistence & System Preference Fallback
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('learnx_active_tab');
      if (stored && ['path', 'lesson', 'assessment', 'progress', 'tutor', 'teacher', 'teacher-roster', 'teacher-interventions', 'teacher-curriculum', 'admin'].includes(stored as AppTab)) {
        setActiveTab(stored as AppTab);
      }
    } catch {
      // Storage is optional. The public snapshot remains usable without it.
    }
    try {
      const stored = localStorage.getItem('learnx_theme_mode');
      setIsDarkMode(stored === 'dark' || (stored !== 'light' && Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches)));
    } catch {
      // The external early-theme script also tolerates unavailable storage.
    }
    setHasRestoredPreferences(true);
  }, []);

  // Toggle Dark Mode
  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Sync dark class on html root and persist in localStorage
  useEffect(() => {
    if (!hasRestoredPreferences) return;
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      try {
        localStorage.setItem('learnx_theme_mode', 'dark');
      } catch {}
    } else {
      root.classList.remove('dark');
      try {
        localStorage.setItem('learnx_theme_mode', 'light');
      } catch {}
    }
  }, [isDarkMode, hasRestoredPreferences]);

  // Global keyboard shortcut: Ctrl+D or Cmd+D to toggle dark mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when inside an input or textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setIsDarkMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Persist activeTab to sessionStorage for navigation state persistence
  useEffect(() => {
    if (!hasRestoredPreferences) return;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('learnx_active_tab', activeTab);
      } catch (e) {
        console.warn('Failed to save activeTab to sessionStorage:', e);
      }
    }
  }, [activeTab, hasRestoredPreferences]);

  // Session expiry handler
  useEffect(() => {
    const handleAuthUnauthorized = (e: CustomEvent) => {
      setAuthMessage(e.detail?.message || 'Session expired. Please sign in again.');
      setCurrentUser(null);
      setIsAuthModalOpen(true);
      setAuthInitialRole('student');
    };

    window.addEventListener('auth:unauthorized', handleAuthUnauthorized as EventListener);
    return () => {
      window.removeEventListener('auth:unauthorized', handleAuthUnauthorized as EventListener);
    };
  }, []);

  // Modals
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState<boolean>(false);
  const [isDiagnosticMandatory, setIsDiagnosticMandatory] = useState<boolean>(false);

  // Current Subject Concepts
  const currentConcepts = conceptsMap[currentSubject] || conceptsMap['Mathematics'];
  const activeConcept =
    currentConcepts.find((c) => c.id === selectedConceptId) || currentConcepts[0];

  // Questions for active concept
  const currentQuestions = SAMPLE_QUESTIONS[activeConcept.id] || [
    {
      id: `generic-q-${activeConcept.id}`,
      conceptId: activeConcept.id,
      conceptTitle: activeConcept.title,
      text: `In the study of ${activeConcept.title}, what is the key relationship governing the transformation of initial state parameters?`,
      options: [
        'The output strictly depends on foundational boundary equations and rate of change',
        'Parameters are invariant and cannot be modified by external constraints',
        'Only random perturbation dictates the state progression',
        'Previous states have zero effect on downstream derivatives',
      ],
      correctIndex: 0,
      explanation: `In ${activeConcept.title}, system evolution is governed by foundational boundary equations and specific rates of change.`,
      hint: `Think about prerequisite balance and cause-and-effect mappings.`,
      difficulty: activeConcept.difficulty,
    },
  ];

  // Subject Switcher
  const handleSelectSubject = (subject: string) => {
    setCurrentSubject(subject);
    const firstConcept = conceptsMap[subject]?.[0];
    if (firstConcept) {
      setSelectedConceptId(firstConcept.id);
    }
  };

  // Font adjustments with smooth visual scaling
  const handleAdjustFontSize = (delta: number) => {
    setFontSizeMultiplier((prev) => {
      const next = Number((prev + delta).toFixed(2));
      return Math.min(1.5, Math.max(0.75, next));
    });
  };

  const handleResetFontSize = () => {
    setFontSizeMultiplier(1.0);
  };

  // Real-time smooth font and layout zoom across the app
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * fontSizeMultiplier}px`;
    document.documentElement.style.setProperty('--app-scale', `${fontSizeMultiplier}`);
    return () => {
      document.documentElement.style.fontSize = '16px';
    };
  }, [fontSizeMultiplier]);

  // Font Theme Change Handler
  const handleChangeFontTheme = (newTheme: FontTheme) => {
    setFontTheme(newTheme);
    if (newTheme === 'lexend' || newTheme === 'dyslexic') {
      setIsDyslexicFont(true);
    } else {
      setIsDyslexicFont(false);
    }
  };

  // Auth Handlers
  const handleOpenAuth = (role: UserRole = 'student') => {
    setAuthInitialRole(role);
    setIsAuthModalOpen(true);
  };

  const handleLogin = (
    user: UserProfile,
    conceptsMapFromDb?: Record<string, ConceptNode[]>,
    isNew?: boolean
  ) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      setActiveTab('admin');
    } else if (user.role === 'teacher') {
      setActiveTab('teacher');
    } else {
      // registerStudentInCohort(user);
      const studentConcepts = conceptsMapFromDb || getStudentConcepts(user.id, user.studentId, user.name);
      setConceptsMap(studentConcepts);
      setLocalStudentConceptsCache(user.id, studentConcepts);
      if (user.interest) {
        setInterest(user.interest);
      }
      setStreakCount(user.streakCount || 1);

      // Select first available or in-progress concept in current subject
      const subConcepts = studentConcepts[currentSubject] || [];
      const focal =
        subConcepts.find((c) => c.status === 'in_progress' || c.status === 'remediation') ||
        subConcepts[0];
      if (focal) setSelectedConceptId(focal.id);

      if (activeTab === 'teacher') {
        setActiveTab('path');
      }

      // If new student or diagnostic not completed, mandate diagnostic baseline calibration
      const needsCalibration = Boolean(isNew || user.isNew || !user.diagnosticCompleted);
      if (needsCalibration) {
        setIsDiagnosticMandatory(true);
        setIsDiagnosticOpen(true);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await apiLogoutUser();
    } catch (e) {
      console.warn('Logout API failed', e);
    }
    clearSensitiveClientStorage();
    setCurrentUser(null);
    setConceptsMap(getCleanCurriculumConcepts());
    setStreakCount(0);
    setInterest('Cricket & Sports');
    setActiveTab('path');
  };

  // Initial sync of active student into cohort roster on startup
  useEffect(() => {
    if (currentUser && currentUser.role === 'student') {
      // registerStudentInCohort(currentUser);
      // Synchronize latest curriculum concepts AND profile (interest theme, streak) from MySQL database
      apiFetchStudentProgress(currentUser.id)
        .then((progress) => {
          if (progress) {
            if (progress.conceptsMap && Object.keys(progress.conceptsMap).length > 0) {
              setConceptsMap(progress.conceptsMap);
              setLocalStudentConceptsCache(currentUser.id, progress.conceptsMap);
            }
            if (progress.interest) {
              setInterest(progress.interest);
            }
            if (progress.streakCount !== undefined) {
              setStreakCount(progress.streakCount);
            }
          }
        })
        .catch(() => {});
    }
  }, [currentUser?.id]);



  // Update concept mastery and cascade unlocks in the Knowledge Graph via true Topological DAG routing
  const handleUpdateConceptMastery = (conceptId: string, breakdown: MasteryBreakdown) => {
    setConceptsMap((prev) => {
      const subjectList = prev[currentSubject] || [];
      const updatedList = subjectList.map((c) => {
        if (c.id === conceptId) {
          const newScore = breakdown.finalScore;
          let newStatus = c.status;
          if (newScore >= 80 || (breakdown.bktMastery ?? 0) >= 0.85) {
            newStatus = 'mastered';
          } else if (breakdown.recommendation === 'remediate') {
            newStatus = 'remediation';
          } else if (breakdown.recommendation === 'step_back') {
            newStatus = 'prerequisite_gap';
          } else {
            newStatus = 'in_progress';
          }
          return { ...c, masteryScore: newScore, status: newStatus };
        }
        return c;
      });

      // True Topological DAG Routing:
      // Unlock any downstream nodes whose prerequisites are now completely satisfied (P(L) >= 0.85 or score >= 80)
      const isNodeMastered = breakdown.finalScore >= 80 || (breakdown.bktMastery ?? 0) >= 0.85;
      if (isNodeMastered) {
        updatedList.forEach((node, idx) => {
          if (node.status === 'locked' && arePrerequisitesMastered(node, updatedList)) {
            updatedList[idx] = { ...node, status: 'in_progress' };
          }
        });
      } else if (breakdown.recommendation === 'step_back') {
        // Backtrack to weakest prerequisite foundation if student failed
        const currentNode = updatedList.find((c) => c.id === conceptId);
        if (currentNode) {
          const weakest = findWeakestPrerequisite(currentNode, updatedList);
          if (weakest) {
            setSelectedConceptId(weakest.id);
          }
        }
      }

      const updatedMap = {
        ...prev,
        [currentSubject]: updatedList,
      };

      // Persist real-time to logged-in student profile
      if (currentUser && currentUser.role === 'student') {
        saveStudentConcepts(currentUser.id, updatedMap);
      }

      return updatedMap;
    });

    // Synchronize student's updated mastery with cohort roster in teacher portal
    if (currentUser?.role === 'student') {
      const struggling = breakdown.recommendation === 'remediate' ? activeConcept.title : null;
      updateStudentMasteryInCohort(currentUser, breakdown.finalScore, struggling);
    }
  };

  // Dynamic Teacher Curriculum Studio Handlers
  const handleAddConceptNode = (newNode: ConceptNode) => {
    setConceptsMap((prev) => {
      const list = prev[newNode.subject] || [];
      const updated = {
        ...prev,
        [newNode.subject]: [...list, newNode],
      };
      if (currentUser?.id) {
        saveStudentConcepts(currentUser.id, updated);
      }
      return updated;
    });
  };

  const handleDeleteConceptNode = (nodeId: string) => {
    setConceptsMap((prev) => {
      const updated: Record<string, ConceptNode[]> = {};
      Object.keys(prev).forEach((subj) => {
        updated[subj] = prev[subj].filter((c) => c.id !== nodeId);
      });
      if (currentUser?.id) {
        saveStudentConcepts(currentUser.id, updated);
      }
      return updated;
    });
  };

  // Diagnostic calibration handler
  const handleCompleteDiagnostic = (
    results: { conceptId: string; score: number }[],
    newConceptsMap?: Record<string, ConceptNode[]>
  ) => {
    if (newConceptsMap) {
      setConceptsMap(newConceptsMap);
      if (currentUser && currentUser.role === 'student') {
        saveStudentConcepts(currentUser.id, newConceptsMap);
      }
      const subNodes = newConceptsMap[currentSubject] || [];
      const focal = subNodes.find((c) => c.status === 'in_progress' || c.status === 'prerequisite_gap') || subNodes[0];
      if (focal) setSelectedConceptId(focal.id);
    } else {
      setConceptsMap((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((subj) => {
          updated[subj] = updated[subj].map((concept) => {
            const match = results.find((r) => r.conceptId === concept.id);
            if (match) {
              return {
                ...concept,
                masteryScore: match.score,
                status: match.score >= 80 ? 'mastered' : match.score >= 50 ? 'in_progress' : 'prerequisite_gap',
              };
            }
            return concept;
          });
        });

        // Persist real-time to logged-in student profile
        if (currentUser && currentUser.role === 'student') {
          saveStudentConcepts(currentUser.id, updated);
        }

        return updated;
      });
    }

    setIsDiagnosticOpen(false);
    setIsDiagnosticMandatory(false);

    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        diagnosticCompleted: true,
        isNew: false,
      });
    }

    // Synchronize diagnostic baseline to cohort roster
    if (currentUser?.role === 'student' && results.length > 0) {
      const avgScore = Math.round(results.reduce((acc, r) => acc + r.score, 0) / results.length);
      updateStudentMasteryInCohort(currentUser, avgScore);
    }
  };

  // Overall average mastery for current subject (0 if unauthenticated / guest)
  const overallMastery =
    currentUser && currentUser.role === 'student'
      ? Math.round(
          currentConcepts.reduce((acc, c) => acc + c.masteryScore, 0) / (currentConcepts.length || 1)
        )
      : 0;

  const handleOpenTutorWithStruggle = (conceptTitle: string, reason: string) => {
    setStruggleNote(`Struggle identified on "${conceptTitle}": ${reason}`);
    setActiveTab('tutor');
  };

  // Check for unknown pathnames and show Not Found view
  if (isNotFoundPath) {
    return (
      <div className="min-h-screen editorial-canvas-bg flex items-center justify-center overflow-x-hidden">
        <NotFoundView />
      </div>
    );
  }

  // The public knowledge graph is safe to render while the optional session
  // check is in flight. Protected tabs still wait for authentication, which
  // avoids exposing private data while removing the auth request from the
  // anonymous homepage's critical rendering path.
  const isWaitingForSession = isAuthLoading && activeTab !== 'path';

  return (
    <div
      id="app-root"
      className={`min-h-screen flex flex-col editorial-canvas-bg text-stone-900 transition-colors duration-200 theme-font-${fontTheme} overflow-x-hidden ${
        isDyslexicFont || fontTheme === 'lexend' ? 'font-dyslexic' : ''
      } ${isHighContrast ? 'high-contrast' : ''} ${isDarkMode ? 'dark' : ''}`}
      style={{
        zoom: fontSizeMultiplier,
      }}
    >
      <a href="#main-content" className="skip-to-content">Skip to content</a>
      <div className="learnx-scroll-progress" aria-hidden="true">
        <span style={{ width: `${scrollProgress}%` }} />
      </div>
      {/* Universal Header with Authentication and Font Selector */}
      <Header
        currentSubject={currentSubject}
        onSelectSubject={handleSelectSubject}
        allSubjects={SUBJECTS}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === 'admin') {
            setActiveTab('admin');
            return;
          }
          if (['teacher', 'teacher-roster', 'teacher-interventions', 'teacher-curriculum'].includes(tab)) {
            if (isVerifiedTeacher || isAdmin) {
              setActiveTab(tab);
            } else {
              // Role-based protection: Student accounts cannot access Faculty records
              handleOpenAuth('teacher');
            }
          } else {
            // Student-specific tabs: Strictly block verified faculty unless admin is previewing
            if (isVerifiedTeacher && !isAdmin) {
              return;
            }
            setActiveTab(tab);
          }
        }}
        interest={interest}
        onChangeInterest={(newInterest) => {
          setInterest(newInterest);
          if (currentUser && currentUser.role === 'student') {
            const updated = { ...currentUser, interest: newInterest };
            setCurrentUser(updated);
            // registerStudentInCohort(updated);
            // Real-time synchronization to XAMPP MySQL database
            apiUpdateUserProfile(currentUser.id, { interest: newInterest });
          }
        }}

        fontSizeMultiplier={fontSizeMultiplier}
        onAdjustFontSize={handleAdjustFontSize}
        onResetFontSize={handleResetFontSize}
        isDyslexicFont={isDyslexicFont}
        onToggleDyslexicFont={() => {
          const nextVal = !isDyslexicFont;
          setIsDyslexicFont(nextVal);
          if (nextVal) setFontTheme('lexend');
          else setFontTheme('outfit');
        }}
        isHighContrast={isHighContrast}
        onToggleHighContrast={() => setIsHighContrast(!isHighContrast)}
        ttsEnabled={ttsEnabled}
        onToggleTTS={() => setTtsEnabled(!ttsEnabled)}
        streakCount={streakCount}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        fontTheme={fontTheme}
        onChangeFontTheme={handleChangeFontTheme}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
      />

      {/* Main App Body */}
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 outline-none">
        <PublicIntro hasLessonHeading={activeTab === 'lesson' && !isWaitingForSession} />
        <div id="learning-app">
        {isWaitingForSession ? (
          <LoadingShell label="Authenticating secure session..." />
        ) : (
        <Suspense fallback={<DeferredViewFallback />}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={activeTab === 'path' ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
            {/* Admin Control Room & CRM Hub */}
            {activeTab === 'admin' && (
              isAdmin ? (
                <AdminDashboard
                  currentUser={currentUser!}
                  onLogout={handleLogout}
                  onSelectTab={(tab) => setActiveTab(tab)}
                />
              ) : (
                <AdminAccessRestrictedView
                  currentUser={currentUser}
                  onAdminAuthenticated={(adminUser) => {
                    handleLogin(adminUser);
                    setActiveTab('admin');
                  }}
                  onBackToStudent={() => setActiveTab('path')}
                />
              )
            )}

            {/* Student Navigation Views (Accessible to students, guests, or admin preview) */}
            {activeTab !== 'admin' && (!isVerifiedTeacher || isAdmin) && activeTab === 'path' && (
              <KnowledgeGraph
                concepts={currentConcepts}
                selectedConceptId={selectedConceptId}
                onSelectConcept={setSelectedConceptId}
                onStartLesson={(id) => {
                  setSelectedConceptId(id);
                  setActiveTab('lesson');
                }}
                onStartAssessment={(id) => {
                  setSelectedConceptId(id);
                  setActiveTab('assessment');
                }}
                onOpenDiagnostic={() => {
                  if (!currentUser) {
                    handleOpenAuth('student');
                  } else {
                    setIsDiagnosticOpen(true);
                  }
                }}
                overallMastery={overallMastery}
                onViewAnalytics={() => setActiveTab('progress')}
                currentUser={currentUser}
                onOpenAuth={handleOpenAuth}
              />
            )}

            {activeTab !== 'admin' && (!isVerifiedTeacher || isAdmin) && activeTab === 'lesson' && (
              <LessonView
                concept={activeConcept}
                interest={interest}
                strategy={strategy}
                onChangeStrategy={setStrategy}
                onProceedToAssessment={(id) => {
                  setSelectedConceptId(id);
                  setActiveTab('assessment');
                }}
                ttsEnabled={ttsEnabled}
              />
            )}

            {activeTab !== 'admin' && (!isVerifiedTeacher || isAdmin) && activeTab === 'assessment' && (
              <AssessmentView
                concept={{
                  ...activeConcept,
                  grade: currentUser?.grade || activeConcept.grade || 'Class 10',
                }}
                allConcepts={currentConcepts}
                questions={currentQuestions}
                currentStrategy={strategy}
                studentInterest={interest}
                userId={currentUser?.id}
                onUpdateConceptMastery={handleUpdateConceptMastery}
                onNavigateToConcept={(id) => {
                  setSelectedConceptId(id);
                  setActiveTab('lesson');
                }}
                onChangeStrategy={(newStrat) => {
                  setStrategy(newStrat);
                  setActiveTab('lesson');
                }}
                onOpenTutorWithStruggle={handleOpenTutorWithStruggle}
              />
            )}

            {activeTab !== 'admin' && (!isVerifiedTeacher || isAdmin) && activeTab === 'progress' && (
              <StudentGrowthDashboard
                currentSubject={currentSubject}
                concepts={currentConcepts}
                allSubjects={SUBJECTS}
                conceptsMap={conceptsMap}
                onNavigateToConcept={(id, action) => {
                  setSelectedConceptId(id);
                  setActiveTab(action);
                }}
                currentUser={currentUser}
                overallMastery={overallMastery}
                onOpenAuth={handleOpenAuth}
              />
            )}

            {activeTab !== 'admin' && (!isVerifiedTeacher || isAdmin) && activeTab === 'tutor' && (
              <AITutorChat
                concept={activeConcept}
                interest={interest}
                struggleNote={struggleNote}
                onClearStruggleNote={() => setStruggleNote(undefined)}
                studentId={currentUser?.id}
              />
            )}

            {/* Educator Navigation Views (Gated strictly to Verified Faculty or Admin preview) */}
            {activeTab !== 'admin' && ['teacher', 'teacher-roster', 'teacher-interventions', 'teacher-curriculum'].includes(activeTab) && (
              (isVerifiedTeacher || isAdmin) ? (
                <TeacherDashboard
                  currentUser={currentUser}
                  activeSection={
                    activeTab === 'teacher-roster'
                      ? 'roster'
                      : activeTab === 'teacher-interventions'
                      ? 'interventions'
                      : activeTab === 'teacher-curriculum'
                      ? 'curriculum'
                      : 'overview'
                  }
                  onSelectSection={(sec) => {
                    if (sec === 'overview') setActiveTab('teacher');
                    else if (sec === 'roster') setActiveTab('teacher-roster');
                    else if (sec === 'interventions') setActiveTab('teacher-interventions');
                    else if (sec === 'curriculum') setActiveTab('teacher-curriculum');
                  }}
                  currentSubject={currentSubject}
                  onSelectSubject={setCurrentSubject}
                  conceptsMap={conceptsMap}
                  onAddConceptNode={handleAddConceptNode}
                  onDeleteConceptNode={handleDeleteConceptNode}
                />
              ) : (
                <TeacherAccessRestrictedView
                  currentUser={currentUser}
                  onOpenTeacherAuth={() => handleOpenAuth('teacher')}
                  onBackToStudent={() => setActiveTab('path')}
                />
              )
            )}
            </motion.div>
          </AnimatePresence>
        </Suspense>
        )}
        </div>
        <PublicSeoContent author={publicAuthor} config={siteConfig} utmParams={utmParams} />
      </main>

      {/* Modern Clean Footer */}
      <footer id="site-footer" className="bg-white border-t border-stone-200/80 py-6 px-4 text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2 font-medium">
            <a href="/" className="font-display font-semibold text-stone-900 hover:text-[#114B43]">
              LearnX
            </a>
            <span className="text-stone-300">•</span>
            <span>Personalized Learning Platform</span>
            <span aria-hidden="true">•</span>
            <span>© {PUBLIC_COPYRIGHT_YEAR} LearnX</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-stone-400 font-medium">
            <a href="/#curriculum" className="hover:text-stone-700 hover:underline">Curriculum</a>
            <span aria-hidden="true">•</span>
            <a href="/#faq" className="hover:text-stone-700 hover:underline">FAQs</a>
            <span aria-hidden="true">•</span>
            <a href="/#main-content" className="hover:text-stone-700 hover:underline">Back to learning</a>
            {siteConfig.lastUpdated && (
              <>
                <span aria-hidden="true">•</span>
                <span>Updated {siteConfig.lastUpdated}</span>
              </>
            )}
          </div>
        </div>
        {(siteConfig.phrase || hasContact) && (
          <div className="max-w-7xl mx-auto mt-4 flex flex-wrap items-center justify-center gap-4 border-t border-stone-100 pt-4">
            {siteConfig.phrase && <span className="break-words text-[11px] text-stone-500">{siteConfig.phrase}</span>}
            <PublicContactLinks contact={contact} utmParams={utmParams} />
          </div>
        )}
      </footer>

      {showBackToTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-20 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-lg transition hover:-translate-y-0.5 hover:border-[#114B43] hover:text-[#114B43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#114B43] sm:bottom-20 md:bottom-5"
          aria-label="Back to top"
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Top</span>
        </button>
      )}

      {hasContact && primaryContactHref && (
        <a
          href={primaryContactHref.startsWith('http') ? appendPublicUtmParameters(primaryContactHref, utmParams) : primaryContactHref}
          target={primaryContactHref.startsWith('http') ? '_blank' : undefined}
          rel={primaryContactHref.startsWith('http') ? 'noreferrer' : undefined}
          className="fixed bottom-20 left-5 z-30 inline-flex max-w-[calc(100vw-7rem)] items-center gap-2 rounded-full bg-[#114B43] px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#0f453c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#114B43] focus-visible:ring-offset-2 sm:bottom-20 md:bottom-5"
          aria-label="Contact LearnX"
        >
          <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Contact</span>
        </a>
      )}

      {showConsentBanner && (
        <aside className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-700 shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-5">LearnX stores a small preference and optional campaign attribution in your browser to keep the public experience consistent.</p>
          <button
            type="button"
            onClick={dismissConsentBanner}
            className="shrink-0 rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#114B43]"
          >
            Got it
          </button>
        </aside>
      )}

      {/* Authentication Modal (Student Sign In / Sign Up & Teacher Sign In / Sign Up) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthMessage(null);
        }}
        onLogin={handleLogin}
        initialRole={authInitialRole}
        initialMessage={authMessage}
      />

      {/* Diagnostic Baseline Modal: load its curriculum and math renderer only when opened. */}
      {isDiagnosticOpen && (
        <Suspense fallback={null}>
          <DiagnosticModal
            isOpen={isDiagnosticOpen}
            onClose={() => {
              if (!isDiagnosticMandatory) {
                setIsDiagnosticOpen(false);
              }
            }}
            onCompleteDiagnostic={handleCompleteDiagnostic}
            isMandatory={isDiagnosticMandatory}
            grade={currentUser?.grade || 'Class 10'}
            subject={currentSubject}
            userId={currentUser?.id}
          />
        </Suspense>
      )}
    </div>
  );
}


