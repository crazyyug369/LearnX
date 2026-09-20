import { MasteryBreakdown, TeachingStrategy, BloomsBreakdown, BloomsLevel, ConceptNode } from '../types';
import { calculateQuizBkt, getBktParametersForConcept, calculateBktStep } from '../data/bktParams';

export interface CalculationParams {
  recentAccuracy: number; // 0 to 100
  historicalAccuracy: number; // 0 to 100
  timeSpentSeconds: number; // average time per question
  optionChangesCount: number; // hesitation signal
  confidenceLevel: 'Low' | 'Medium' | 'High';
  prerequisiteScores: number[];
  consecutiveFailures: number;
  currentStrategy: TeachingStrategy;
  conceptTitle?: string;
  answers?: {
    isCorrect: boolean;
    bloomsLevel?: BloomsLevel;
    timeSeconds?: number;
  }[];
}

/**
 * Calculates Bloom's cognitive taxonomy breakdown across recall, application, and analysis
 */
export function calculateBloomsBreakdown(
  answers: { isCorrect: boolean; bloomsLevel?: BloomsLevel }[]
): BloomsBreakdown {
  if (!answers || answers.length === 0) {
    return { recallAccuracy: 100, applicationAccuracy: 100, analysisAccuracy: 100 };
  }

  const levels: Record<BloomsLevel, { total: number; correct: number }> = {
    Recall: { total: 0, correct: 0 },
    Application: { total: 0, correct: 0 },
    Analysis: { total: 0, correct: 0 },
  };

  answers.forEach((ans, idx) => {
    // Default evenly distributed if question doesn't tag bloomsLevel
    const level: BloomsLevel =
      ans.bloomsLevel || (idx === 0 ? 'Recall' : idx === 1 ? 'Application' : 'Analysis');
    levels[level].total += 1;
    if (ans.isCorrect) levels[level].correct += 1;
  });

  const getAcc = (lvl: BloomsLevel) => {
    if (levels[lvl].total === 0) return 100;
    return Math.round((levels[lvl].correct / levels[lvl].total) * 100);
  };

  const rec = getAcc('Recall');
  const app = getAcc('Application');
  const ana = getAcc('Analysis');

  return {
    recallAccuracy: rec,
    applicationAccuracy: app,
    analysisAccuracy: ana,
    Recall: rec,
    Application: app,
    Analysis: ana,
  };
}

export function calculateMastery(params: CalculationParams): MasteryBreakdown {
  const {
    recentAccuracy,
    historicalAccuracy,
    timeSpentSeconds,
    optionChangesCount,
    confidenceLevel,
    prerequisiteScores,
    consecutiveFailures,
    currentStrategy,
    conceptTitle = 'General Concept',
    answers,
  } = params;

  // 1. Recent Performance (Weight 40%)
  const recent = Math.max(0, Math.min(100, recentAccuracy));

  // 2. Historical Performance (Weight 25%)
  const historical = Math.max(0, Math.min(100, historicalAccuracy));

  // 3. Response Behaviour (Weight 20%)
  // Penalize extreme hesitation: ideal time is 15-40s. Penalty if > 50s or > 1 answer change.
  let behaviorScore = 100;
  if (timeSpentSeconds > 50) {
    behaviorScore -= Math.min(30, (timeSpentSeconds - 50) * 1.2);
  }
  if (optionChangesCount > 1) {
    behaviorScore -= Math.min(30, (optionChangesCount - 1) * 15);
  }
  behaviorScore = Math.max(25, Math.min(100, Math.round(behaviorScore)));

  // 4. Confidence Score (Weight 15%)
  const confidenceMap = { Low: 35, Medium: 70, High: 100 };
  const confidence = confidenceMap[confidenceLevel];

  // 5. Empirical Bayesian Knowledge Tracing (Corbett & Anderson standard)
  let bktProbability = 0.5;
  let finalScore = Math.round(recent * 0.4 + historical * 0.25 + behaviorScore * 0.2 + confidence * 0.15);
  let bloomsBreakdown: BloomsBreakdown | undefined = undefined;

  if (answers && answers.length > 0) {
    const bktResult = calculateQuizBkt(answers, conceptTitle, historicalAccuracy);
    bktProbability = bktResult.posteriorL;
    // BKT mastery mapped to [0, 100] with slight behavioral sensitivity
    finalScore = bktResult.masteryScore;
    bloomsBreakdown = calculateBloomsBreakdown(answers);
  } else {
    // If answers array is omitted, derive BKT probability from recent accuracy
    bktProbability = Math.min(0.99, Math.max(0.01, recent / 100));
  }

  // Decision Engine Logic (as specified on Page 3 of PDF):
  // - Prerequisite weak (<65%) -> Go backward to foundation
  // - Repeated misconception (>=2) -> Change teaching strategy
  // - Mastery < 65% or P(L) < 0.65 -> Remediate
  // - Mastery achieved (>=85% or P(L) >= 0.85) -> Advance

  const weakPrerequisite = prerequisiteScores.some((score) => score < 65);

  let recommendation: MasteryBreakdown['recommendation'] = 'advance';
  let reason = '';

  if (weakPrerequisite) {
    recommendation = 'step_back';
    reason =
      'Prerequisite foundation score is below 65%. To avoid compounding confusion, the engine recommends reviewing foundational concepts first.';
  } else if (consecutiveFailures >= 2) {
    recommendation = 'change_strategy';
    reason = `Repeated misconception observed under "${currentStrategy}". The engine is pivoting to an alternative cognitive strategy to unlock intuitive comprehension.`;
  } else if (finalScore < 65 || bktProbability < 0.65) {
    recommendation = 'remediate';
    reason =
      'Current mastery score is below the 65% progression threshold. Focused remediation and scaffolded practice is initiated.';
  } else {
    recommendation = 'advance';
    reason =
      'Mastery criterion achieved! Empirical BKT latent probability meets target threshold, unlocking downstream concepts on your Knowledge DAG.';
  }

  return {
    recentPerformance: Math.round(recent),
    historicalPerformance: Math.round(historical),
    responseBehaviour: behaviorScore,
    confidenceScore: confidence,
    finalScore,
    recommendation,
    reason,
    bktMastery: bktProbability,
    bloomsBreakdown,
  };
}

export function getNextRecommendedStrategy(current: TeachingStrategy): TeachingStrategy {
  const list: TeachingStrategy[] = [
    'Analogy & Real-world',
    'Socratic / Guided Inquiry',
    'Step-by-Step Visual',
    'First Principles',
  ];
  const idx = list.indexOf(current);
  return list[(idx + 1) % list.length];
}

/**
 * Validates whether all prerequisites for a target node are mastered (P(L) >= 0.85 or score >= 80)
 */
export function arePrerequisitesMastered(
  targetNode: ConceptNode,
  allNodes: ConceptNode[]
): boolean {
  if (!targetNode.prerequisites || targetNode.prerequisites.length === 0) {
    return true;
  }
  return targetNode.prerequisites.every((prereqId) => {
    const prereq = allNodes.find((n) => n.id === prereqId);
    if (!prereq) return true; // If prerequisite not in current list, assume satisfied
    return prereq.status === 'mastered' || prereq.masteryScore >= 80;
  });
}

/**
 * Finds the weakest prerequisite node for backward remediation routing
 */
export function findWeakestPrerequisite(
  targetNode: ConceptNode,
  allNodes: ConceptNode[]
): ConceptNode | null {
  if (!targetNode.prerequisites || targetNode.prerequisites.length === 0) {
    return null;
  }
  let weakest: ConceptNode | null = null;
  let minScore = 101;

  for (const pid of targetNode.prerequisites) {
    const node = allNodes.find((n) => n.id === pid);
    if (node && node.masteryScore < minScore) {
      minScore = node.masteryScore;
      weakest = node;
    }
  }
  return weakest;
}

