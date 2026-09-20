export type UserRole = 'student' | 'teacher' | 'admin' | 'institution';

export type AppTab =
  | 'path'
  | 'lesson'
  | 'assessment'
  | 'progress'
  | 'tutor'
  | 'teacher'
  | 'teacher-roster'
  | 'teacher-interventions'
  | 'teacher-curriculum'
  | 'admin';

export type ThemeMode = 'light' | 'dark';

export type FontTheme =
  | 'modern-sans'
  | 'editorial-serif'
  | 'dyslexic'
  | 'outfit'
  | 'jakarta'
  | 'newsreader'
  | 'lexend';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  grade?: string;
  studentId?: string;
  interest?: StudentInterest;
  streakCount?: number;
  institution?: string;
  institutionId?: string;
  institutionCode?: string;
  department?: string;
  teacherId?: string;
  gradeOrDepartment?: string;
  studentIdOrFacultyId?: string;
  diagnosticCompleted?: boolean;
  isNew?: boolean;
}

export interface Institution {
  id: string;
  code: string;
  name: string;
  email: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  status: 'active' | 'suspended' | 'pending';
  teacherCount?: number;
  studentCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export type StudentInterest =
  | 'Cricket & Sports'
  | 'Gaming & Sci-Fi'
  | 'Music & Creative Arts'
  | 'Space & Astronomy'
  | 'Robotics & Coding';

export type TeachingStrategy =
  | 'Analogy & Real-world'
  | 'Socratic / Guided Inquiry'
  | 'Step-by-Step Visual'
  | 'First Principles';

export type NodeStatus =
  | 'locked'
  | 'prerequisite_gap'
  | 'in_progress'
  | 'remediation'
  | 'mastered';

export interface ConceptNode {
  id: string;
  title: string;
  subject: string;
  category: string;
  description: string;
  prerequisites: string[]; // ids of prerequisite nodes
  masteryScore: number; // 0 to 100
  status: NodeStatus;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedTimeMin: number;
  tags: string[];
  grade?: string;
}

export type BloomsLevel = 'Recall' | 'Application' | 'Analysis';

export interface BloomsBreakdown {
  recallAccuracy: number;
  applicationAccuracy: number;
  analysisAccuracy: number;
  Recall?: number;
  Application?: number;
  Analysis?: number;
}

export interface MasteryBreakdown {
  recentPerformance: number; // weight 40% (0-100)
  historicalPerformance: number; // weight 25% (0-100)
  responseBehaviour: number; // weight 20% (0-100, based on time, hesitation, revisions)
  confidenceScore: number; // weight 15% (0-100, student self-reported)
  finalScore: number; // 0-100 weighted
  recommendation: 'advance' | 'remediate' | 'step_back' | 'change_strategy';
  reason: string;
  bktMastery?: number; // 0.0 to 1.0 (Bayesian Knowledge Tracing latent state P(L_t))
  bloomsBreakdown?: BloomsBreakdown;
}

export interface Question {
  id: string;
  conceptId: string;
  conceptTitle: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hint: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  bloomsLevel?: BloomsLevel;
}

export interface QuizAttempt {
  id: string;
  userId: string;
  conceptId: string;
  conceptTitle: string;
  subject: string;
  score: number;
  accuracy: number;
  isMastered: boolean;
  timeSpent: number;
  bktMastery: number;
  answers: {
    questionId: string;
    selectedOption: number;
    correctOption: number;
    isCorrect: boolean;
    bloomsLevel?: BloomsLevel;
    timeSpent?: number;
  }[];
  bloomsBreakdown?: BloomsBreakdown;
  createdAt: string;
}

export interface LessonContent {
  title: string;
  coreConcept: string;
  interestAnalogy: string;
  keyTakeaways: string[];
  microExample: string;
  checkYourUnderstanding?: {
    question: string;
    hint: string;
    answer: string;
  };
  strategyNote?: string;
  source?: 'gemini' | 'adaptive_engine_fallback';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
  timestamp: string;
  struggleNote?: string;
}

export interface ClassroomStudent {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  grade?: string;
  studentId?: string;
  overallMastery: number;
  strugglingConcept: string | null;
  status: 'On Track' | 'Needs Intervention' | 'Excelling' | 'New Enrollee';
  lastActive: string;
  interest: StudentInterest;
  registeredAt?: number;
  isNewRegistration?: boolean;
  institution?: string;
  institutionId?: string;
  institutionCode?: string;
}

export interface ClassroomAnalytics {
  subject: string;
  classAverageMastery: number;
  atRiskConcepts: { concept: string; failureRate: number; recommendedAction: string }[];
  masteryDistribution: { range: string; count: number }[];
  students: ClassroomStudent[];
}

export interface SystemSettings {
  geminiEnabled: boolean;
  geminiApiKey: string;
  geminiModel: string;
  geminiModelPriority: string[];
  geminiTemperature: number;
  maintenanceMode: boolean;
  announcementBanner: string;
}

export interface AdminCRMUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  studentId?: string;
  teacherId?: string;
  grade?: string;
  institution?: string;
  institutionId?: string;
  institutionCode?: string;
  department?: string;
  interest?: StudentInterest;
  overallMastery?: number;
  strugglingConcept?: string | null;
  status?: string;
  avatar?: string;
  createdAt?: string;
  updatedAt?: string;
  quizCount?: number;
}

export interface QuestionBankItem {
  id: string;
  conceptId: string;
  conceptTitle: string;
  subject: string;
  grade: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  bloomsLevel: string;
  explanation?: string;
  hint?: string;
  createdAt?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorId?: string;
  actorName?: string;
  targetType?: string;
  targetId?: string;
  details?: any;
  ipAddress?: string;
  createdAt: string;
}
