import { z } from 'zod';

export const adaptiveLessonOutputSchema = z.object({
  title: z.string(),
  coreConcept: z.string(),
  interestAnalogy: z.string(),
  keyTakeaways: z.array(z.string()),
  microExample: z.string(),
  checkYourUnderstanding: z.object({
    question: z.string(),
    hint: z.string(),
    answer: z.string()
  }),
  strategyNote: z.string()
});

export const generateQuestionOutputSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number().int().min(0),
  explanation: z.string(),
  hint: z.string(),
  conceptTested: z.string()
});

export const mcqGuidanceOutputSchema = z.object({
  misconceptionAnalysis: z.string(),
  stepByStepCorrection: z.array(z.string()),
  keyFormulaLatex: z.string(),
  formulaName: z.string(),
  socraticHint: z.string(),
  interestAnalogy: z.string(),
  encouragingNote: z.string()
});

export const teacherWorksheetOutputSchema = z.object({
  concept: z.string(),
  problemStatementId: z.number(),
  date: z.string(),
  sectionA: z.object({
    title: z.string(),
    analogy: z.string()
  }),
  sectionB: z.object({
    title: z.string(),
    problems: z.array(z.object({
      number: z.number(),
      tag: z.string(),
      prompt: z.string(),
      answer: z.string()
    }))
  }),
  answerKey: z.string()
});

export const curriculumSuggestionOutputSchema = z.object({
  category: z.string().optional(),
  difficulty: z.string().optional(),
  prerequisites: z.array(z.string()).optional(),
  nextConcepts: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  estimatedTimeMin: z.number().optional(),
  description: z.string().optional(),
  pedagogicalRationale: z.string().optional()
});

