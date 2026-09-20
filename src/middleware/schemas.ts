import { z } from 'zod';

// Reusable primitives
export const emailSchema = z.string().email().max(255);
export const passwordSchema = z.string().min(8).max(100);
export const shortStringSchema = z.string().trim().max(100);
export const longStringSchema = z.string().trim().max(1000);
export const gradeEnum = z.enum(["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"]).or(z.string().trim().max(20)); // Keep broad for now if not strictly enforced, but let's restrict to max length at least.
export const subjectEnum = z.string().trim().max(50);

// Auth Schemas
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email().max(255).optional().or(z.literal('')),
    password: z.string().min(8).max(100).optional().or(z.literal('')),
    name: shortStringSchema.optional(),
    role: shortStringSchema.optional(),
    grade: shortStringSchema.optional(),
    interest: shortStringSchema.optional(),
    studentId: shortStringSchema.optional(),
    institution: shortStringSchema.optional(),
    institutionId: shortStringSchema.optional(),
    institutionCode: shortStringSchema.optional(),
    department: shortStringSchema.optional(),
    teacherId: shortStringSchema.optional(),
  }).passthrough()
});

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email().max(255).optional().or(z.literal('')),
    password: z.string().min(8).max(100).optional().or(z.literal('')),
    name: shortStringSchema.optional(),
    role: shortStringSchema.optional(),
    grade: shortStringSchema.optional(),
    interest: shortStringSchema.optional()
  }).passthrough()
});

export const institutionLoginSchema = z.object({
  body: z.object({
    code: shortStringSchema.optional().or(z.literal('')),
    email: z.union([z.string().email().max(255), z.string().trim().max(255)]).optional().or(z.literal('')),
    password: passwordSchema.optional().or(z.literal('')),
  }).passthrough()
});

export const claimPasswordSchema = z.object({
  body: z.object({
    email: z.string().email().max(255),
    newPassword: passwordSchema
  }).passthrough()
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email().max(255)
  }).passthrough()
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
  }).passthrough()
});

export const idParamsSchema = z.object({
  params: z.object({
    id: shortStringSchema
  }).passthrough()
});

export const idAndUserParamsSchema = z.object({
  params: z.object({
    id: shortStringSchema,
    userId: shortStringSchema
  }).passthrough()
});

export const adminInstitutionsQuerySchema = z.object({
  query: z.object({
    search: shortStringSchema.optional(),
    status: shortStringSchema.optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  }).passthrough()
});

export const adminInstitutionPostSchema = z.object({
  body: z.object({
    code: shortStringSchema,
    name: shortStringSchema,
    email: emailSchema.optional().or(z.literal(''))
  }).passthrough()
});

export const adminQuestionsQuerySchema = z.object({
  query: z.object({
    search: shortStringSchema.optional(),
    subject: subjectEnum.optional(),
    grade: shortStringSchema.optional(),
    difficulty: shortStringSchema.optional(),
  }).passthrough()
});

export const adminAuditLogsQuerySchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().positive().max(1000).optional()
  }).passthrough()
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
  }).passthrough()
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
  }).passthrough()
});

export const aiGenerateQuestionSchema = z.object({
  body: z.object({
    concept: shortStringSchema,
    subject: subjectEnum,
    targetDifficulty: shortStringSchema.optional(),
    interest: shortStringSchema.optional(),
    previousIncorrect: z.array(z.any()).optional()
  }).passthrough()
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
  }).passthrough()
});

export const quizQuestionsSchema = z.object({
  body: z.object({
    conceptId: shortStringSchema.optional(),
    conceptTitle: shortStringSchema.optional(),
    subject: subjectEnum.optional(),
    grade: shortStringSchema.optional(),
    interest: shortStringSchema.optional()
  }).passthrough()
});

export const diagnosticCalibrateSchema = z.object({
  body: z.object({
    userId: shortStringSchema.optional(),
    grade: shortStringSchema.optional(),
    subject: subjectEnum.optional(),
    answers: z.array(z.any()).optional()
  }).passthrough()
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
  }).passthrough()
});

export const curriculumAiSuggestSchema = z.object({
  body: z.object({
    title: shortStringSchema.optional(),
    subject: subjectEnum.optional(),
    grade: shortStringSchema.optional(),
  }).passthrough()
});

export const teacherWorksheetGenerateSchema = z.object({
  body: z.object({
    conceptTitle: shortStringSchema.optional(),
    subject: subjectEnum.optional(),
    grade: shortStringSchema.optional()
  }).passthrough()
});

export const modelsBktTraceSchema = z.object({
  body: z.object({
    skillName: shortStringSchema.optional(),
    answers: z.array(z.any()).optional(),
    initialPrior: z.coerce.number().optional()
  }).passthrough()
});
