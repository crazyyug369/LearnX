import React, { useState, useEffect } from 'react';
import {
  Users,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  CheckCircle,
  Sparkles,
  Filter,
  UserPlus,
  Search,
  Trash2,
  Sliders,
  Download,
  Clock,
  X,
  GraduationCap,
  Sparkle,
  Network,
  ArrowRight,
  ArrowUpDown,
  Layers,
} from 'lucide-react';

import { normalizeGradeName } from '../data/gradeCurriculum';
import { ClassroomStudent, StudentInterest, UserProfile, ConceptNode } from '../types';
import { TeacherCurriculumMap } from './TeacherCurriculumMap';
import { RemediationInterventionStudio } from './RemediationInterventionStudio';
import {
  getCohortStudents,
  saveCohortStudents,
  registerStudentInCohort,
  updateStudentMasteryInCohort,
  removeStudentFromCohort,
  resetCohortToDefaults,
  deduplicateStudents,
} from '../utils/studentStorage';

export interface TeacherDashboardProps {
  currentUser?: UserProfile | null;
  activeSection?: 'overview' | 'roster' | 'interventions' | 'curriculum';
  onSelectSection?: (section: 'overview' | 'roster' | 'interventions' | 'curriculum') => void;
  currentSubject?: string;
  onSelectSubject?: (subj: string) => void;
  conceptsMap?: Record<string, ConceptNode[]>;
  onAddConceptNode?: (newNode: ConceptNode) => void;
  onDeleteConceptNode?: (nodeId: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  currentUser,
  activeSection,
  onSelectSection,
  currentSubject,
  onSelectSubject,
  conceptsMap,
  onAddConceptNode,
  onDeleteConceptNode,
}) => {
  const [internalSection, setInternalSection] = useState<'overview' | 'roster' | 'interventions' | 'curriculum'>('overview');
  const section = activeSection || internalSection;

  const handleSwitchSection = (newSec: 'overview' | 'roster' | 'interventions' | 'curriculum') => {
    setInternalSection(newSec);
    if (onSelectSection) {
      onSelectSection(newSec);
    }
  };

  const [students, setStudents] = useState<ClassroomStudent[]>(() => deduplicateStudents(getCohortStudents()));
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'new' | 'Needs Intervention' | 'Excelling' | 'On Track'
  >('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedInterest, setSelectedInterest] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'default' | 'mastery_desc' | 'mastery_asc' | 'name_asc' | 'grade_asc'>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [interventionTriggered, setInterventionTriggered] = useState<string | null>(null);
  const [bottlenecks, setBottlenecks] = useState<
    Array<{
      concept: string;
      failureRate: number;
      recommendedAction: string;
      affectedLearnersCount?: number;
    }>
  >([]);
  const [velocityGain, setVelocityGain] = useState<number | null>(null);

  // Modal States
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [calibrateStudent, setCalibrateStudent] = useState<ClassroomStudent | null>(null);
  const [newMasteryScore, setNewMasteryScore] = useState<number>(50);

  // New Student Form State
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentGrade, setNewStudentGrade] = useState('Class 10');
  const [newStudentId, setNewStudentId] = useState(`STU-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [newStudentInterest, setNewStudentInterest] = useState<StudentInterest>('Cricket & Sports');
  const [newStudentMastery, setNewStudentMastery] = useState(50);
  const [enrollSuccessMessage, setEnrollSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('Just now');

  // Load and subscribe to real-time cohort and telemetry updates
  useEffect(() => {
    // Initial sync from local storage
    setStudents(deduplicateStudents(getCohortStudents()));
    setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    // Sync cohort and bottlenecks from server API in background
    const syncServerData = () => {
      fetch('/api/students')
        .then((res) => {
          if (!res.ok) throw new Error('API failure');
          return res.json();
        })
        .then((data) => {
          if (data.success && Array.isArray(data.students) && data.students.length > 0) {
            const deduped = deduplicateStudents(data.students);
            saveCohortStudents(deduped);
            setStudents(deduped);
            setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          }
        })
        .catch(() => {});

      fetch('/api/teacher/analytics/bottlenecks')
        .then((res) => {
          if (!res.ok) throw new Error('API failure');
          return res.json();
        })
        .then((data) => {
          if (data.success && Array.isArray(data.bottlenecks)) {
            setBottlenecks(data.bottlenecks);
            if (typeof data.velocityGain === 'number' || data.velocityGain === null) {
              setVelocityGain(data.velocityGain);
            }
          }
        })
        .catch(() => {
          setBottlenecks([]);
          setVelocityGain(null);
        });
    };

    syncServerData();

    // Listen to custom window event triggered whenever a student registers or updates
    const handleCohortUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<ClassroomStudent[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setStudents(deduplicateStudents(customEvent.detail));
      } else {
        setStudents(deduplicateStudents(getCohortStudents()));
      }
      setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };

    // Cross-tab synchronization via storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'learnx_cohort_students_v3') {
        setStudents(deduplicateStudents(getCohortStudents()));
        setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    };

    // Periodic polling to ensure real-time telemetry from MySQL is always fresh
    const pollInterval = setInterval(syncServerData, 4000);

    window.addEventListener('learnx_cohort_updated', handleCohortUpdate);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('learnx_cohort_updated', handleCohortUpdate);
      window.removeEventListener('storage', handleStorage);
      clearInterval(pollInterval);
    };
  }, []);

  // Standardized Class List & Counts
  const standardClasses = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];
  const classCounts = standardClasses.reduce((acc, cls) => {
    acc[cls] = students.filter((s) => normalizeGradeName(s.grade) === cls).length;
    return acc;
  }, {} as Record<string, number>);

  // Compute metrics scoped to selectedGrade or entire active cohort
  const overviewStudents = selectedGrade === 'all'
    ? students
    : students.filter((s) => normalizeGradeName(s.grade) === selectedGrade);

  const activeCount = students.length;
  const overviewActiveCount = overviewStudents.length;
  const newRegistrationsCount = students.filter(
    (s) => s.isNewRegistration || s.status === 'New Enrollee'
  ).length;

  const dynamicAverageMastery =
    overviewActiveCount > 0
      ? Math.round(overviewStudents.reduce((acc, s) => acc + s.overallMastery, 0) / overviewActiveCount)
      : 0;

  // Dynamic mastery distribution (scoped to current class/cohort selection)
  const masteryDistribution = [
    {
      range: '< 60% (Prerequisite Gap)',
      count: overviewStudents.filter((s) => s.overallMastery < 60).length,
      color: 'bg-rose-600',
    },
    {
      range: '60% - 75% (In Progress)',
      count: overviewStudents.filter((s) => s.overallMastery >= 60 && s.overallMastery < 76).length,
      color: 'bg-amber-600',
    },
    {
      range: '76% - 89% (Proficient)',
      count: overviewStudents.filter((s) => s.overallMastery >= 76 && s.overallMastery < 90).length,
      color: 'bg-[#114B43]',
    },
    {
      range: '90% - 100% (Mastered)',
      count: overviewStudents.filter((s) => s.overallMastery >= 90).length,
      color: 'bg-emerald-600',
    },
  ];

  // Comprehensive multi-dimensional student filter
  let filteredStudents = students.filter((s) => {
    const studentGrade = normalizeGradeName(s.grade);

    // 1. Grade / Class filter
    if (selectedGrade !== 'all' && studentGrade !== selectedGrade) {
      return false;
    }

    // 2. Status filter
    if (filterStatus === 'new' && !(s.isNewRegistration || s.status === 'New Enrollee')) {
      return false;
    }
    if (filterStatus !== 'all' && filterStatus !== 'new' && s.status !== filterStatus) {
      return false;
    }

    // 3. Interest filter
    if (selectedInterest !== 'all' && (s.interest || '').toLowerCase() !== selectedInterest.toLowerCase()) {
      return false;
    }

    // 4. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = s.name.toLowerCase().includes(q);
      const matchEmail = s.email ? s.email.toLowerCase().includes(q) : false;
      const matchId = s.studentId ? s.studentId.toLowerCase().includes(q) : false;
      const matchGrade = studentGrade.toLowerCase().includes(q);
      const matchInterest = s.interest.toLowerCase().includes(q);
      return matchName || matchEmail || matchId || matchGrade || matchInterest;
    }

    return true;
  });

  // 5. Apply sorting
  if (sortBy === 'mastery_desc') {
    filteredStudents = [...filteredStudents].sort((a, b) => b.overallMastery - a.overallMastery);
  } else if (sortBy === 'mastery_asc') {
    filteredStudents = [...filteredStudents].sort((a, b) => a.overallMastery - b.overallMastery);
  } else if (sortBy === 'name_asc') {
    filteredStudents = [...filteredStudents].sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'grade_asc') {
    filteredStudents = [...filteredStudents].sort((a, b) =>
      normalizeGradeName(a.grade).localeCompare(normalizeGradeName(b.grade))
    );
  }

  const handleTriggerIntervention = async (concept: string) => {
    setInterventionTriggered(concept);
    setIsDeploying(concept);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/teacher/interventions/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptTitle: concept,
          subject: currentSubject || 'Mathematics',
          teacherId: currentUser?.id || 't-1',
        }),
      });
      if (!res.ok) {
        throw new Error('Unable to deploy intervention. Please try again.');
      }
    } catch (err) {
      console.error('Failed to deploy intervention:', err);
      setErrorMessage('Unable to deploy intervention. Please try again.');
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setIsDeploying(null);
      setTimeout(() => {
        setInterventionTriggered(null);
      }, 4000);
    }
  };

  // Direct Teacher Portal Student Enrollment Handler with complete MySQL persistence
  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    setIsEnrolling(true);
    setErrorMessage(null);

    const studentPayload = {
      name: newStudentName.trim(),
      email:
        newStudentEmail.trim() ||
        `${newStudentName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@student.learnx.org`,
      grade: newStudentGrade,
      studentId: newStudentId.trim() || `STU-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      interest: newStudentInterest,
      overallMastery: newStudentMastery,
      status: 'New Enrollee' as const,
    };

    // 1. Local storage registration for instantaneous UI responsiveness
    const enrolled = registerStudentInCohort(studentPayload);

    // 2. MySQL database persistence
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentPayload),
      });
      if (!res.ok) {
        throw new Error('Unable to enroll student. Please try again.');
      }
      setEnrollSuccessMessage(`Successfully enrolled student: ${enrolled.name}`);
      setTimeout(() => {
        setEnrollSuccessMessage(null);
      }, 4000);

      // Reset form & close modal
      setNewStudentName('');
      setNewStudentEmail('');
      setNewStudentId(`STU-2026-${Math.floor(1000 + Math.random() * 9000)}`);
      setNewStudentMastery(50);
      setIsEnrollModalOpen(false);
    } catch (err) {
      console.error('Failed to persist student enrollment to DB:', err);
      setErrorMessage('Unable to enroll student. Please try again.');
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setIsEnrolling(false);
    }
  };

  // Quick Calibrate Mastery Handler
  const handleSaveCalibration = () => {
    if (!calibrateStudent) return;
    updateStudentMasteryInCohort(calibrateStudent.id, newMasteryScore);
    setCalibrateStudent(null);
  };

  // Unenroll student handler with persistent MySQL deletion
  const handleUnenroll = async (studentId: string, name: string) => {
    if (window.confirm(`Unenroll student "${name}" from this cohort roster?`)) {
      setIsDeleting(studentId);
      setErrorMessage(null);
      try {
        removeStudentFromCohort(studentId);
        setStudents((prev) => prev.filter((s) => s.id !== studentId));
        const res = await fetch(`/api/students/${studentId}`, { method: 'DELETE' });
        if (!res.ok) {
          throw new Error('Unable to unenroll student. Please try again.');
        }
      } catch (err) {
        console.error('Failed to delete student from backend DB:', err);
        setErrorMessage('Unable to unenroll student. Please try again.');
        setTimeout(() => setErrorMessage(null), 4000);
        // Rollback local state on failure
        setStudents(deduplicateStudents(getCohortStudents()));
      } finally {
        setIsDeleting(null);
      }
    }
  };

  // Export roster to CSV
  const handleExportRoster = () => {
    const headers = ['Student ID', 'Name', 'Email', 'Grade', 'Overall Mastery', 'Status', 'Interest', 'Last Active'];
    const rows = students.map((s) => [
      s.studentId || s.id,
      `"${s.name}"`,
      `"${s.email || ''}"`,
      s.grade || 'Grade 10',
      `${s.overallMastery}%`,
      s.status,
      `"${s.interest}"`,
      `"${s.lastActive}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `LearnX_Cohort_Roster_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Teacher Perspective Header */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-sans font-medium px-2.5 py-0.5 rounded bg-stone-100 text-stone-700 uppercase tracking-wider border border-stone-200">
              Classroom Progress Overview
            </span>
            <span className="text-xs text-stone-400 font-sans">• Realtime Student Updates</span>
            {currentUser?.teacherId && (
              <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                <Users className="w-3 h-3 text-emerald-600" />
                <span>Verified Teacher ID: {currentUser.teacherId}</span>
              </span>
            )}
            <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/30 flex items-center gap-1.5 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Real-Time Sync: {lastSyncedTime}</span>
            </span>
            {newRegistrationsCount > 0 && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 animate-pulse">
                <Sparkle className="w-3 h-3 text-emerald-600" />
                {newRegistrationsCount} New Enrollee{newRegistrationsCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <h2 className="text-xl font-serif font-semibold text-stone-900 mt-1 tracking-tight">
            {currentSubject || 'General'} Class Live Cohort
            {currentUser?.name && (
              <span className="font-sans font-normal text-sm text-stone-500 ml-2">
                • {currentUser.name} {currentUser.institution ? `(${currentUser.institution})` : ''}
              </span>
            )}
          </h2>
          <p className="text-xs text-stone-500 mt-1 max-w-2xl leading-relaxed">
            Monitor student progress, spot learning hurdles early, and assign targeted practice exercises.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            id="btn-register-new-student"
            onClick={() => setIsEnrollModalOpen(true)}
            className="flex items-center gap-2 bg-[#114B43] hover:bg-[#0c3832] text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            title="Register or enroll a new student into this classroom cohort"
          >
            <UserPlus className="w-4 h-4" />
            <span>Enroll / Register Student</span>
          </button>

          <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200/80 text-right shrink-0">
            <span className="text-[11px] text-stone-500 font-medium">Cohort Avg Mastery</span>
            <div className="text-2xl font-serif font-semibold text-[#114B43]">
              {dynamicAverageMastery}%
            </div>
          </div>
        </div>
      </div>

      {/* Educator Sub-Navigation Tab Bar */}
      <div className="bg-white rounded-xl border border-stone-200 p-1.5 shadow-2xs flex items-center gap-1 overflow-x-auto scrollbar-none">
        <button
          id="tab-btn-teacher-overview"
          onClick={() => handleSwitchSection('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
            section === 'overview'
              ? 'bg-[#114B43] text-white font-semibold shadow-2xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Overview & Analytics</span>
        </button>

        <button
          id="tab-btn-teacher-roster"
          onClick={() => handleSwitchSection('roster')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
            section === 'roster'
              ? 'bg-[#114B43] text-white font-semibold shadow-2xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Student Roster & Directory</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-200/60 text-stone-800">
            {students.length}
          </span>
        </button>

        <button
          id="tab-btn-teacher-interventions"
          onClick={() => handleSwitchSection('interventions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
            section === 'interventions'
              ? 'bg-[#114B43] text-white font-semibold shadow-2xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Help Topics & Action Plans</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-semibold">
            {students.filter((s) => s.status === 'Needs Intervention').length}
          </span>
        </button>

        <button
          id="tab-btn-teacher-curriculum"
          onClick={() => handleSwitchSection('curriculum')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
            section === 'curriculum'
              ? 'bg-[#114B43] text-white font-semibold shadow-2xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Network className="w-4 h-4" />
          <span>Curriculum Knowledge Map</span>
        </button>
      </div>

      {/* Success Notification Alert */}
      {enrollSuccessMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between gap-2 animate-in fade-in shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{enrollSuccessMessage}</span>
          </div>
          <span className="text-[11px] text-emerald-700 bg-white/80 px-2 py-0.5 rounded border border-emerald-200 font-mono">
            Roster Synced
          </span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center justify-between gap-2 animate-in fade-in shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <span className="text-[11px] text-rose-700 bg-white/80 px-2 py-0.5 rounded border border-rose-200 font-mono">
            Error
          </span>
        </div>
      )}

      {/* SECTION 1: Overview & BKT Distribution */}
      {section === 'overview' && (
        <>
          {/* Class Cohort Scope Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-stone-200/90 shadow-2xs">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#114B43]" />
              <span className="text-xs font-semibold text-stone-900">Cohort Class Scope:</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setSelectedGrade('all')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedGrade === 'all'
                    ? 'bg-[#114B43] text-white shadow-2xs font-semibold'
                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'
                }`}
              >
                All Classes ({activeCount})
              </button>
              {standardClasses.map((cls) => {
                const cnt = classCounts[cls] || 0;
                if (cnt === 0 && selectedGrade !== cls) return null;
                return (
                  <button
                    key={cls}
                    onClick={() => setSelectedGrade(cls)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      selectedGrade === cls
                        ? 'bg-[#114B43] text-white shadow-2xs font-semibold'
                        : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'
                    }`}
                  >
                    {cls} ({cnt})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Overview Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Active Cohort with Live Registrations */}
        <div className="bg-white p-5 rounded-xl border border-stone-200/90 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              {selectedGrade === 'all' ? 'Active Cohort' : `${selectedGrade} Cohort`}
            </p>
            <h3 className="text-2xl font-serif font-semibold text-stone-900 tracking-tight">
              {overviewActiveCount} Learners
            </h3>
            <p className="text-[11px] text-emerald-800 font-medium flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>{selectedGrade === 'all' ? 'All grades in school' : `Enrolled in ${selectedGrade}`}</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Newly Registered Students Card */}
        <div className="bg-white p-5 rounded-xl border border-stone-200/90 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">New Registrations</p>
            <h3 className="text-2xl font-serif font-semibold text-[#114B43] tracking-tight">
              {newRegistrationsCount} Enrolled
            </h3>
            <p className="text-[11px] text-stone-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              <span>Synced via portal & auth</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#114B43] flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>

        {/* Identified Bottlenecks */}
        <div className="bg-white p-5 rounded-xl border border-stone-200/90 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Identified Bottlenecks</p>
            <h3 className="text-2xl font-serif font-semibold text-amber-800 tracking-tight">
              {bottlenecks.length} Concepts
            </h3>
            <p className="text-[11px] text-stone-400">Flagged in prerequisite trees</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Learning Velocity Gain */}
        <div className="bg-white p-5 rounded-xl border border-stone-200/90 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Velocity Gain</p>
            {typeof velocityGain === 'number' ? (
              <h3 className="text-2xl font-serif font-semibold text-[#114B43] tracking-tight">+{velocityGain}%</h3>
            ) : (
              <h3 className="text-lg font-serif font-semibold text-stone-500 tracking-tight">Insufficient data</h3>
            )}
            <p className="text-[11px] text-stone-400">Improvement after practice</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-stone-100 text-[#114B43] flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Grid: At Risk Concepts & Mastery Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: At-Risk Concepts & Recommended Interventions */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-stone-200/90 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h3 className="text-sm font-serif font-semibold text-stone-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Topic Hurdles & Recommended Practice</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Concepts where multiple students showed response hesitation or prerequisite gaps
              </p>
            </div>
          </div>

          {interventionTriggered && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Practice exercises assigned for: <strong>{interventionTriggered}</strong>
              </span>
            </div>
          )}

          <div className="space-y-3">
            {bottlenecks.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-stone-200 border-dashed bg-stone-50">
                <div className="w-10 h-10 mx-auto bg-stone-200 text-stone-400 rounded-full flex items-center justify-center mb-3">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-medium text-stone-900">No active bottlenecks</h4>
                <p className="text-xs text-stone-500 mt-1">
                  Students are progressing smoothly or no data is available yet.
                </p>
              </div>
            ) : (
              bottlenecks.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-stone-200/80 bg-stone-50/50 hover:bg-stone-50 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-serif font-semibold text-xs sm:text-sm text-stone-900">
                    {item.concept}
                  </h4>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                    {item.failureRate}% Failure Rate
                  </span>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed">
                  <strong className="text-stone-800">Action Plan:</strong> {item.recommendedAction}
                </p>

                <div className="pt-1 flex justify-end">
                  <button
                    id={`btn-trigger-intervention-${idx}`}
                    onClick={() => handleTriggerIntervention(item.concept)}
                    className="py-1.5 px-3 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Assign Practice Set</span>
                  </button>
                </div>
              </div>
            )))}
          </div>
        </div>

        {/* Right 5 Cols: Mastery Distribution & Institution Analytics */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-stone-200/90 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <h3 className="text-sm font-serif font-semibold text-stone-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-stone-700" />
              <span>Cohort Mastery Distribution</span>
            </h3>
            <span className="text-xs text-stone-500 font-medium">Cohort of {activeCount}</span>
          </div>

          <div className="space-y-3.5 py-2">
            {masteryDistribution.map((dist, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-stone-700">{dist.range}</span>
                  <span className="font-serif font-semibold text-stone-900">
                    {dist.count} learner{dist.count !== 1 ? 's' : ''} ({activeCount > 0 ? Math.round((dist.count / activeCount) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${dist.color}`}
                    style={{ width: `${activeCount > 0 ? (dist.count / activeCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Research citation box */}
          <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 text-stone-900 space-y-1.5 text-xs mt-4">
            <div className="flex items-center gap-1.5 font-medium text-stone-800">
              <Sparkles className="w-3.5 h-3.5 text-stone-600" />
              <span>Student Learning Progress</span>
            </div>
            <p className="leading-relaxed text-[11px] text-stone-600">
              Student progress updates automatically as quizzes and practice tests are completed, tailoring upcoming lessons to each learner's needs.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Roster Teaser in Overview */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-serif font-semibold text-stone-900 text-sm">Classroom Student Directory</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            {activeCount} active learners currently enrolled. {newRegistrationsCount} newly added this term.
          </p>
        </div>
        <button
          onClick={() => handleSwitchSection('roster')}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#114B43] hover:bg-[#0c3832] text-white text-xs font-semibold rounded-xl transition-all shadow-2xs cursor-pointer whitespace-nowrap"
        >
          <span>Open Full Student Directory ({students.length})</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  )}

      {/* SECTION 2: Individual Student Live Roster */}
      {section === 'roster' && (
        <div className="bg-white rounded-xl border border-stone-200/90 p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-serif font-semibold text-stone-900">
                Live Classroom Roster
              </h3>
              <span className="text-xs bg-stone-100 text-stone-700 font-mono px-2 py-0.5 rounded border border-stone-200">
                {filteredStudents.length} of {activeCount} Students
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Includes newly registered students and existing enrolled learners with updated topic mastery
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="search-students-roster"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, roll ID..."
                className="pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:outline-none focus:border-[#114B43] w-48 sm:w-60 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Export Roster */}
            <button
              id="btn-export-cohort-roster"
              onClick={handleExportRoster}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-stone-700 transition-all shadow-2xs cursor-pointer"
              title="Download cohort roster as CSV"
            >
              <Download className="w-3.5 h-3.5 text-stone-500" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {/* Enroll New Student CTA */}
            <button
              id="btn-open-enroll-modal"
              onClick={() => setIsEnrollModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#114B43] hover:bg-[#0c3832] text-white rounded-lg text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Enroll Student</span>
            </button>
          </div>
        </div>

        {/* Tier 1: Class / Standard Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-stone-50/80 rounded-xl border border-stone-200">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-[11px] font-semibold text-stone-600 uppercase tracking-wider mr-1 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-[#114B43]" />
              <span>Filter by Class:</span>
            </span>
            <button
              id="filter-class-all"
              onClick={() => setSelectedGrade('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                selectedGrade === 'all'
                  ? 'bg-[#114B43] text-white shadow-2xs font-semibold'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              All Classes ({activeCount})
            </button>
            {standardClasses.map((cls) => {
              const cnt = classCounts[cls] || 0;
              return (
                <button
                  key={cls}
                  id={`filter-class-${cls.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setSelectedGrade(cls)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    selectedGrade === cls
                      ? 'bg-[#114B43] text-white shadow-2xs font-semibold'
                      : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                  }`}
                >
                  {cls} ({cnt})
                </button>
              );
            })}
          </div>

          {/* Active Filter Clear */}
          {(selectedGrade !== 'all' || filterStatus !== 'all' || selectedInterest !== 'all' || searchQuery || sortBy !== 'default') && (
            <button
              onClick={() => {
                setSelectedGrade('all');
                setFilterStatus('all');
                setSelectedInterest('all');
                setSearchQuery('');
                setSortBy('default');
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-medium underline flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>

        {/* Tier 2: Status, Pedagogical Theme & Sorting Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <Filter className="w-3.5 h-3.5 text-stone-400 mr-1" />
            <button
              id="filter-all-students"
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-stone-900 text-white shadow-2xs font-semibold'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              All Statuses ({selectedGrade === 'all' ? activeCount : classCounts[selectedGrade] || 0})
            </button>

            <button
              id="filter-new-students"
              onClick={() => setFilterStatus('new')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                filterStatus === 'new'
                  ? 'bg-emerald-800 text-white shadow-2xs font-semibold'
                  : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200'
              }`}
            >
              <Sparkle className="w-3 h-3" />
              <span>New Enrollees ({newRegistrationsCount})</span>
            </button>

            <button
              id="filter-needs-intervention"
              onClick={() => setFilterStatus('Needs Intervention')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filterStatus === 'Needs Intervention'
                  ? 'bg-amber-800 text-white shadow-2xs font-semibold'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              Needs Intervention
            </button>

            <button
              id="filter-excelling"
              onClick={() => setFilterStatus('Excelling')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filterStatus === 'Excelling'
                  ? 'bg-[#114B43] text-white shadow-2xs font-semibold'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              Excelling
            </button>

            <button
              id="filter-on-track"
              onClick={() => setFilterStatus('On Track')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filterStatus === 'On Track'
                  ? 'bg-stone-700 text-white shadow-2xs font-semibold'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              On Track
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Interest Lens Filter */}
            <select
              value={selectedInterest}
              onChange={(e) => setSelectedInterest(e.target.value)}
              className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-700 focus:outline-none focus:border-[#114B43] cursor-pointer"
            >
              <option value="all">All Interests</option>
              <option value="Cricket & Sports">Cricket & Sports</option>
              <option value="Gaming & Sci-Fi">Gaming & Sci-Fi</option>
              <option value="Robotics & Coding">Robotics & Coding</option>
              <option value="Space & Astronomy">Space & Astronomy</option>
              <option value="Music & Creative Arts">Music & Creative Arts</option>
            </select>

            {/* Sort Order Selector */}
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-stone-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-700 focus:outline-none focus:border-[#114B43] cursor-pointer"
              >
                <option value="default">Sort: Recent</option>
                <option value="mastery_desc">Highest Mastery</option>
                <option value="mastery_asc">Lowest Mastery</option>
                <option value="name_asc">Name (A–Z)</option>
                <option value="grade_asc">Class / Grade</option>
              </select>
            </div>

            <button
              onClick={() => {
                if (window.confirm('Reset cohort to standard roster?')) {
                  resetCohortToDefaults();
                }
              }}
              className="text-[11px] text-stone-400 hover:text-stone-600 underline cursor-pointer ml-1 whitespace-nowrap"
              title="Reset cohort roster"
            >
              Reset Defaults
            </button>
          </div>
        </div>

        {/* Table of Students */}
        <div className="overflow-x-auto rounded-xl border border-stone-100">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 font-sans font-medium uppercase tracking-wider text-[11px]">
                <th scope="col" className="py-3 px-3.5">Student Profile</th>
                <th scope="col" className="py-3 px-3.5">Grade / Roll</th>
                <th scope="col" className="py-3 px-3.5">Overall Mastery</th>
                <th scope="col" className="py-3 px-3.5">Bottleneck / Struggle</th>
                <th scope="col" className="py-3 px-3.5">Interest Lens</th>
                <th scope="col" className="py-3 px-3.5">Status</th>
                <th scope="col" className="py-3 px-3.5">Activity</th>
                <th scope="col" className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-400">
                    <p className="font-serif text-sm text-stone-600">No students match current filter.</p>
                    <p className="text-xs mt-1">Try clearing search or click "+ Enroll Student" above.</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const isNew = student.isNewRegistration || student.status === 'New Enrollee';
                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-stone-50/80 transition-colors ${
                        isNew ? 'bg-emerald-50/30 font-sans' : ''
                      }`}
                    >
                      {/* Name & Avatar */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <img
                              src={student.avatar}
                              alt={student.name}
                              onError={(e) => {
                                // fallback to initials avatar
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                              className="w-8 h-8 rounded-full object-cover border border-stone-200 shrink-0"
                            />
                            {isNew && (
                              <span
                                className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse"
                                title="Newly registered student"
                              />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-serif font-semibold text-stone-900 text-xs sm:text-sm">
                                {student.name}
                              </span>
                              {isNew && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  New
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-400 truncate max-w-[170px]">
                              {student.email || 'No email specified'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Grade & Roll */}
                      <td className="py-3 px-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-stone-100 text-stone-800 border border-stone-200">
                          {normalizeGradeName(student.grade)}
                        </span>
                        <div className="text-[10px] font-mono text-stone-400 mt-0.5">
                          {student.studentId || student.id}
                        </div>
                      </td>

                      {/* Overall Mastery */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-semibold text-stone-900 w-8">
                            {student.overallMastery}%
                          </span>
                          <div className="w-16 sm:w-20 bg-stone-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                student.overallMastery >= 80
                                  ? 'bg-emerald-600'
                                  : student.overallMastery >= 65
                                  ? 'bg-[#114B43]'
                                  : 'bg-amber-600'
                              }`}
                              style={{ width: `${student.overallMastery}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Struggling Concept */}
                      <td className="py-3 px-3.5">
                        {student.strugglingConcept ? (
                          <span className="inline-flex items-center gap-1 font-medium text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                            <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                            <span className="truncate max-w-[140px]">{student.strugglingConcept}</span>
                          </span>
                        ) : isNew ? (
                          <span className="text-stone-500 text-[11px] flex items-center gap-1 font-medium">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            <span>Diagnostic Ready</span>
                          </span>
                        ) : (
                          <span className="text-emerald-800 font-medium flex items-center gap-1 text-[11px]">
                            <CheckCircle className="w-3 h-3 text-emerald-600" /> On Track
                          </span>
                        )}
                      </td>

                      {/* Interest Lens */}
                      <td className="py-3 px-3.5">
                        <span className="inline-block px-2 py-0.5 bg-stone-100 text-stone-700 rounded text-[11px] font-medium border border-stone-200">
                          {student.interest}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5">
                        <span
                          className={`font-semibold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider inline-block ${
                            student.status === 'Excelling'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : student.status === 'Needs Intervention'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : student.status === 'New Enrollee'
                              ? 'bg-teal-50 text-teal-800 border border-teal-200'
                              : 'bg-stone-100 text-stone-700 border border-stone-200'
                          }`}
                        >
                          {student.status}
                        </span>
                      </td>

                      {/* Last Active */}
                      <td className="py-3 px-3.5 text-stone-500 text-[11px] whitespace-nowrap">
                        {student.lastActive}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`btn-calibrate-${student.id}`}
                            onClick={() => {
                              setCalibrateStudent(student);
                              setNewMasteryScore(student.overallMastery);
                            }}
                            className="p-3 hover:bg-stone-100 rounded text-stone-500 hover:text-stone-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                            aria-label="Calibrate student mastery score"
                          >
                            <Sliders className="w-4 h-4" aria-hidden="true" />
                          </button>

                          <button
                            id={`btn-unenroll-${student.id}`}
                            onClick={() => handleUnenroll(student.id, student.name)}
                            className="p-3 hover:bg-rose-50 rounded text-stone-400 hover:text-rose-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                            aria-label="Unenroll student"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}

      {/* SECTION 3: Bottlenecks & Interventions Studio */}
      {section === 'interventions' && (
        <RemediationInterventionStudio
          students={students}
          bottlenecks={bottlenecks}
        />
      )}

      {/* SECTION 4: Educator Curriculum Knowledge Map */}
      {section === 'curriculum' && (
        <TeacherCurriculumMap
          currentSubject={currentSubject || 'Mathematics'}
          concepts={conceptsMap?.[currentSubject || 'Mathematics'] || []}
          onSelectSubject={onSelectSubject}
          atRiskConcepts={bottlenecks}
          onAddConceptNode={onAddConceptNode}
          onDeleteConceptNode={onDeleteConceptNode}
        />
      )}

      {/* MODAL 1: Enroll / Register New Student */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-stone-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#114B43] text-white flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-semibold text-stone-900 text-sm">
                    Enroll Student to Classroom
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Instantly syncs with the classroom roster and student course map
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEnrollModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEnrollStudent} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Student Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  id="enroll-student-name"
                  placeholder="e.g. Manthan Prajapati"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900 font-medium"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Student Email Address</label>
                <input
                  type="email"
                  id="enroll-student-email"
                  placeholder="e.g. manthan@student.learnx.org"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Grade / Standard</label>
                  <select
                    id="enroll-student-grade"
                    value={newStudentGrade}
                    onChange={(e) => setNewStudentGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900 cursor-pointer"
                  >
                    <option value="Class 6">Class 6</option>
                    <option value="Class 7">Class 7</option>
                    <option value="Class 8">Class 8</option>
                    <option value="Class 9">Class 9</option>
                    <option value="Class 10">Class 10</option>
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Student Roll ID</label>
                  <input
                    type="text"
                    id="enroll-student-id"
                    value={newStudentId}
                    onChange={(e) => setNewStudentId(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Pedagogical Theme / Interest Lens
                </label>
                <select
                  id="enroll-student-interest"
                  value={newStudentInterest}
                  onChange={(e) => setNewStudentInterest(e.target.value as StudentInterest)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900 cursor-pointer"
                >
                  <option value="Cricket & Sports">Cricket & Sports</option>
                  <option value="Gaming & Sci-Fi">Gaming & Sci-Fi</option>
                  <option value="Music & Creative Arts">Music & Creative Arts</option>
                  <option value="Space & Astronomy">Space & Astronomy</option>
                  <option value="Robotics & Coding">Robotics & Coding</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-medium text-stone-700">Initial Diagnostic Baseline</label>
                  <span className="font-serif font-bold text-[#114B43]">{newStudentMastery}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="95"
                  step="5"
                  value={newStudentMastery}
                  onChange={(e) => setNewStudentMastery(Number(e.target.value))}
                  className="w-full accent-[#114B43] cursor-pointer"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-enrollment"
                  className="px-4 py-2 bg-[#114B43] hover:bg-[#0c3832] text-white rounded-xl font-semibold shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Confirm Enrollment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Calibrate Student Mastery */}
      {calibrateStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-stone-200 max-w-sm w-full p-6 shadow-xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#114B43]" />
                <h3 className="font-serif font-semibold text-stone-900 text-sm">
                  Calibrate Student Mastery
                </h3>
              </div>
              <button
                onClick={() => setCalibrateStudent(null)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="font-semibold text-stone-900 text-sm">{calibrateStudent.name}</p>
              <p className="text-[11px] text-stone-500">{calibrateStudent.grade} • {calibrateStudent.email}</p>
            </div>

            <div className="space-y-2 py-2">
              <div className="flex justify-between items-center">
                <span className="font-medium text-stone-700">Adjusted Score:</span>
                <span className="font-serif font-bold text-lg text-[#114B43]">{newMasteryScore}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="1"
                value={newMasteryScore}
                onChange={(e) => setNewMasteryScore(Number(e.target.value))}
                className="w-full accent-[#114B43] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-stone-400">
                <span>10% (Gap)</span>
                <span>65% (Proficient)</span>
                <span>100% (Mastered)</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                onClick={() => setCalibrateStudent(null)}
                className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-save-calibrated-score"
                onClick={handleSaveCalibration}
                className="px-3.5 py-1.5 bg-[#114B43] hover:bg-[#0c3832] text-white rounded-xl font-semibold shadow-2xs cursor-pointer"
              >
                Update Mastery
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
