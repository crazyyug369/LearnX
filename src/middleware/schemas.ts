import { z } from 'zod';

// Reusable primitives
export const emailSchema = z.string().email().max(255);
export const passwordSchema = z.string().min(8).max(100);
export const shortStringSchema = z.string().trim().max(100);
export const longStringSchema = z.string().trim().max(1000);
export const safeImageUrlSchema = z.string().trim().max(500).refine(
  (value) => value.length === 0 || /^https:\/\//i.test(value),
  'Image URLs must use HTTPS',
);
export const gradeEnum = z.enum(["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"]).or(z.string().trim().max(20)); // Keep broad for now if not strictly enforced, but let's restrict to max length at least.
export const subjectEnum = z.string().trim().max(50);
export const userRoleSchema = z.enum(['student', 'teacher', 'admin', 'institution']);

// Auth Schemas
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email().max(255).optional().or(z.literal('')),
    password: z.string().min(8).max(100).optional().or(z.literal('')),
    name: shortStringSchema.optional(),
    role: userRoleSchema.optional(),
    grade: shortStringSchema.optional(),
    interest: shortStringSchema.optional(),
    studentId: shortStringSchema.optional(),
    institution: shortStringSchema.optional(),
    institutionId: shortStringSchema.optional(),
    institutionCode: shortStringSchema.optional(),
    department: shortStringSchema.optional(),
    teacherId: shortStringSchema.optional(),
  }).strip()
});

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email().max(255).optional().or(z.literal('')),
    password: z.string().min(8).max(100).optional().or(z.literal('')),
    name: shortStringSchema.optional(),
    role: userRoleSchema.optional(),
    grade: shortStringSchema.optional(),
    interest: shortStringSchema.optional(),
    studentId: shortStringSchema.optional(),
    institution: shortStringSchema.optional(),
    institutionId: shortStringSchema.optional(),
    institutionCode: shortStringSchema.optional(),
    department: shortStringSchema.optional(),
    teacherId: shortStringSchema.optional(),
  }).strip()
});

export const institutionLoginSchema = z.object({
  body: z.object({
    code: shortStringSchema.optional().or(z.literal('')),
    email: z.union([z.string().email().max(255), z.string().trim().max(255)]).optional().or(z.literal('')),
    password: passwordSchema.optional().or(z.literal('')),
  }).strip()
});

export const claimPasswordSchema = z.object({
  body: z.object({
    email: z.string().email().max(255),
    newPassword: passwordSchema
  }).strip()
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email().max(255)
  }).strip()
});

// Admin Schemas
export const adminUsersQuerySchema = z.object({
  query: z.object({
    search: shortStringSchema.optional(),
    role: shortStringSchema.optional(),
    grade: shortStringSchema.optional(),
    status: shortStringSchema.optional(),
    interest: shortStringSchema.optional(),
    sortBy: shortStringSchema.optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  }).strip()
});

export const idParamsSchema = z.object({
  params: z.object({
    id: shortStringSchema
  }).strip()
});

export const idAndUserParamsSchema = z.object({
  params: z.object({
    id: shortStringSchema,
    userId: shortStringSchema
  }).strip()
});

export const adminInstitutionsQuerySchema = z.object({
  query: z.object({
    search: shortStringSchema.optional(),
    status: shortStringSchema.optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  }).strip()
});

export const adminInstitutionPostSchema = z.object({
  body: z.object({
    code: shortStringSchema,
    name: shortStringSchema,
    email: emailSchema,
    password: passwordSchema.optional().or(z.literal('')),
    contactPerson: shortStringSchema.optional(),
    phone: shortStringSchema.optional(),
    address: longStringSchema.optional(),
    city: shortStringSchema.optional(),
    state: shortStringSchema.optional(),
    status: z.enum(['active', 'suspended', 'pending']).optional(),
  }).strip()
});

export const adminInstitutionUpdateSchema = z.object({
  body: z.object({
    code: shortStringSchema.optional(),
    name: shortStringSchema.optional(),
    email: emailSchema.optional(),
    password: passwordSchema.optional().or(z.literal('')),
    contactPerson: shortStringSchema.optional(),
    phone: shortStringSchema.optional(),
    address: longStringSchema.optional(),
    city: shortStringSchema.optional(),
    state: shortStringSchema.optional(),
    status: z.enum(['active', 'suspended', 'pending']).optional(),
  }).strip(),
});

export const adminQuestionsQuerySchema = z.object({
  query: z.object({
    search: shortStringSchema.optional(),
    subject: subjectEnum.optional(),
    grade: shortStringSchema.optional(),
    difficulty: shortStringSchema.optional(),
  }).strip()
});

export const adminAuditLogsQuerySchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().positive().max(1000).optional()
  }).strip()
});

// AI/Gemini Inputs Schemas
export const aiAdaptiveLessonSchema = z.object({
  body: z.object({
    concept: shortStringSchema,
    subject: subjectEnum,
    interest: shortStringSchema.optional(),
    strategy: shortStringSchema.optional(),
    difficulty: shortStringSchema.optional(),
    prerequisite: shortStringSchema.optional()
  }).strip()
});

export const aiTutorChatSchema = z.object({
  body: z.object({
    message: longStringSchema.optional(),
    userMessage: longStringSchema.optional(),
    concept: shortStringSchema.optional(),
    struggleDetected: z.boolean().optional().or(z.string()), // some times sent as string
    struggleReason: longStringSchema.optional(),
    interest: shortStringSchema.optional(),
    language: shortStringSchema.optional(),
    history: z.array(z.any()).optional()
  }).strip()
});

export const aiGenerateQuestionSchema = z.object({
  body: z.object({
    concept: shortStringSchema,
    subject: subjectEnum,
    targetDifficulty: shortStringSchema.optional(),
    interest: shortStringSchema.optional(),
    previousIncorrect: z.array(z.any()).optional()
  }).strip()
});

export const aiMcqGuidanceSchema = z.object({
  body: z.object({
    question: longStringSchema.optional(),
    conceptTitle: shortStringSchema.optional(),
    selectedOption: shortStringSchema.optional(),
    correctOption: shortStringSchema.optional(),
    explanation: longStringSchema.optional(),
    hint: longStringSchema.optional(),
    subject: subjectEnum.optional(),
    interest: shortStringSchema.optional(),
    customFollowUp: longStringSchema.optional()
  }).strip()
});

export const quizQuestionsSchema = z.object({
  body: z.object({
    conceptId: shortStringSchema.optional(),
    conceptTitle: shortStringSchema.optional(),
    subject: subjectEnum.optional(),
    grade: shortStringSchema.optional(),
    interest: shortStringSchema.optional()
  }).strip()
});

export const diagnosticCalibrateSchema = z.object({
  body: z.object({
    userId: shortStringSchema.optional(),
    grade: shortStringSchema.optional(),
    subject: subjectEnum.optional(),
    answers: z.array(z.any()).optional()
  }).strip()
});

export const curriculumPostSchema = z.object({
  body: z.object({
    id: shortStringSchema.optional(),
    subject: subjectEnum.optional(),
    grade: shortStringSchema.optional(),
    title: shortStringSchema.optional(),
    category: shortStringSchema.optional(),
    description: longStringSchema.optional(),
    difficulty: shortStringSchema.optional(),
    prerequisites: z.array(shortStringSchema).optional(),
    tags: z.array(shortStringSchema).optional(),
    estimatedTime: z.coerce.number().optional(),
    createdBy: shortStringSchema.optional(),
  }).strip()
});

export const curriculumAiSuggestSchema = z.object({
  body: z.object({
    title: shortStringSchema.optional(),
    subject: subjectEnum.optional(),
    grade: shortStringSchema.optional(),
  }).strip()
});

export const teacherWorksheetGenerateSchema = z.object({
  body: z.object({
    conceptTitle: shortStringSchema.optional(),
    subject: subjectEnum.optional(),
    grade: shortStringSchema.optional()
  }).strip()
});

export const modelsBktTraceSchema = z.object({
  body: z.object({
    skillName: shortStringSchema.optional(),
    answers: z.array(z.any()).optional(),
    initialPrior: z.coerce.number().optional()
  }).strip()
});

const boundedScoreSchema = z.coerce.number().finite().min(0).max(100).optional();
const boundedDurationSchema = z.coerce.number().finite().min(0).max(86_400).optional();
const nullableLongStringSchema = longStringSchema.nullable().optional();

export const quizSubmitAttemptSchema = z.object({
  body: z.object({
    // The server always uses req.user.id; this field is accepted only for
    // backwards-compatible clients and is deliberately ignored by the route.
    userId: shortStringSchema.optional(),
    conceptId: shortStringSchema,
    conceptTitle: shortStringSchema.optional(),
    subject: subjectEnum.optional(),
    score: boundedScoreSchema,
    accuracy: boundedScoreSchema,
    isMastered: z.boolean().optional(),
    timeSpent: boundedDurationSchema,
    bktMastery: z.coerce.number().finite().min(0).max(1).optional(),
    answers: z.array(z.unknown()).max(100).optional(),
    bloomsBreakdown: z.unknown().optional(),
  }).strip(),
});

export const studentProgressUpdateSchema = z.object({
  body: z.object({
    conceptsMap: z.record(z.string(), z.unknown()).optional(),
    overallMastery: boundedScoreSchema,
    strugglingConcept: nullableLongStringSchema,
    status: shortStringSchema.optional(),
    streakCount: z.coerce.number().int().min(0).max(100_000).optional(),
    interest: shortStringSchema.optional(),
  }).strip(),
});

export const userProfileUpdateSchema = z.object({
  body: z.object({
    interest: shortStringSchema.optional(),
    grade: shortStringSchema.optional(),
    name: shortStringSchema.optional(),
    streakCount: z.coerce.number().int().min(0).max(100_000).optional(),
    avatar: safeImageUrlSchema.optional().or(z.literal('')),
  }).strip(),
});

export const teacherInterventionSchema = z.object({
  body: z.object({
    conceptTitle: shortStringSchema,
    subject: subjectEnum.optional(),
    teacherId: shortStringSchema.optional(),
  }).strip(),
});

export const studentCreateSchema = z.object({
  body: z.object({
    id: shortStringSchema.optional(),
    name: shortStringSchema,
    email: emailSchema.optional().or(z.literal('')),
    grade: shortStringSchema.optional(),
    studentId: shortStringSchema.optional(),
    avatar: safeImageUrlSchema.optional().or(z.literal('')),
    overallMastery: boundedScoreSchema,
    strugglingConcept: nullableLongStringSchema,
    status: shortStringSchema.optional(),
    interest: shortStringSchema.optional(),
    institution: shortStringSchema.optional(),
    institutionId: shortStringSchema.optional(),
    institutionCode: shortStringSchema.optional(),
  }).strip(),
});

export const studentUpdateSchema = z.object({
  body: z.object({
    overallMastery: boundedScoreSchema,
    strugglingConcept: nullableLongStringSchema,
    status: shortStringSchema.optional(),
    interest: shortStringSchema.optional(),
    grade: shortStringSchema.optional(),
    name: shortStringSchema.optional(),
    email: emailSchema.optional().or(z.literal('')),
  }).strip(),
});

export const adminSettingsSchema = z.object({
  body: z.object({
    geminiEnabled: z.boolean().optional(),
    geminiApiKey: z.string().trim().max(512).optional(),
    geminiModel: shortStringSchema.optional(),
    geminiModelPriority: z.array(shortStringSchema).max(20).optional(),
    geminiTemperature: z.coerce.number().finite().min(0).max(2).optional(),
    maintenanceMode: z.boolean().optional(),
    announcementBanner: longStringSchema.optional(),
    actorName: shortStringSchema.optional(),
  }).strip(),
});

export const adminTestGeminiSchema = z.object({
  body: z.object({
    model: shortStringSchema.optional(),
    actorName: shortStringSchema.optional(),
  }).strip(),
});

export const adminUserCreateSchema = z.object({
  body: z.object({
    name: shortStringSchema,
    email: emailSchema,
    role: userRoleSchema,
    grade: shortStringSchema.optional(),
    interest: shortStringSchema.optional(),
    overallMastery: boundedScoreSchema,
    institution: shortStringSchema.optional(),
    institutionId: shortStringSchema.optional(),
    institutionCode: shortStringSchema.optional(),
    department: shortStringSchema.optional(),
    studentId: shortStringSchema.optional(),
    teacherId: shortStringSchema.optional(),
    actorName: shortStringSchema.optional(),
  }).strip(),
});

export const adminUserUpdateSchema = z.object({
  body: z.object({
    name: shortStringSchema.optional(),
    email: emailSchema.optional(),
    role: userRoleSchema.optional(),
    grade: shortStringSchema.optional(),
    interest: shortStringSchema.optional(),
    overallMastery: boundedScoreSchema,
    status: shortStringSchema.optional(),
    strugglingConcept: nullableLongStringSchema,
    institution: shortStringSchema.optional(),
    institutionId: shortStringSchema.optional(),
    institutionCode: shortStringSchema.optional(),
    department: shortStringSchema.optional(),
    actorName: shortStringSchema.optional(),
  }).strip(),
});

export const adminQuestionSchema = z.object({
  body: z.object({
    id: shortStringSchema.optional(),
    conceptId: shortStringSchema.optional(),
    conceptTitle: shortStringSchema.optional(),
    subject: subjectEnum.optional(),
    grade: shortStringSchema.optional(),
    questionText: longStringSchema,
    options: z.array(shortStringSchema).min(2).max(8),
    correctIndex: z.coerce.number().int().min(0).max(7),
    difficulty: shortStringSchema.optional(),
    bloomsLevel: shortStringSchema.optional(),
    explanation: longStringSchema.optional(),
    hint: longStringSchema.optional(),
    actorName: shortStringSchema.optional(),
  }).strip(),
});
