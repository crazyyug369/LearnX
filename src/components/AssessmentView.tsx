import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Award,
  Youtube,
  ExternalLink,
  Play,
  Brain,
  RefreshCw,
} from 'lucide-react';
import { ConceptNode, Question, MasteryBreakdown, TeachingStrategy } from '../types';
import { calculateMastery, getNextRecommendedStrategy } from '../utils/adaptiveEngine';
import { YouTubeRemediationCard } from './YouTubeRemediationCard';
import { MCQRemediationGuidance } from './MCQRemediationGuidance';
import { MathView } from './MathView';
import { getYouTubeReferenceForQuestion, openYouTubeReference } from '../utils/youtubeReference';
import { StudentInterest } from '../types';
import { apiFetch } from '../utils/apiClient';

interface AnswerLogEntry {
  question: Question;
  selectedOption: number;
  isCorrect: boolean;
  timeSeconds: number;
}

interface AssessmentViewProps {
  concept: ConceptNode;
  allConcepts: ConceptNode[];
  questions: Question[];
  currentStrategy: TeachingStrategy;
  studentInterest?: StudentInterest;
  userId?: string;
  onUpdateConceptMastery: (conceptId: string, breakdown: MasteryBreakdown) => void;
  onNavigateToConcept: (conceptId: string) => void;
  onChangeStrategy: (strategy: TeachingStrategy) => void;
  onOpenTutorWithStruggle: (conceptTitle: string, reason: string) => void;
}

export const AssessmentView: React.FC<AssessmentViewProps> = ({
  concept,
  allConcepts,
  questions,
  currentStrategy,
  studentInterest = 'Cricket & Sports',
  userId,
  onUpdateConceptMastery,
  onNavigateToConcept,
  onChangeStrategy,
  onOpenTutorWithStruggle,
}) => {
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(questions);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [showHint, setShowHint] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [answersLog, setAnswersLog] = useState<AnswerLogEntry[]>([]);
  const [ncertRecommendations, setNcertRecommendations] = useState<string[]>([]);

  // Automatically fetch dynamic Bloom's questions whenever concept or student interest changes
  const fetchAiQuestions = async (isManual = false) => {
    setIsGeneratingQuestions(true);
    try {
      const res = await apiFetch('/api/quiz/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptId: concept.id,
          conceptTitle: concept.title,
          subject: concept.subject,
          grade: (concept as any).grade || 'Class 10',
          interest: studentInterest,
        }),
      });
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();
      if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
        setActiveQuestions(data.questions);
        setCurrentIdx(0);
        setSelectedOption(null);
        setIsSubmitted(false);
        setAnswersLog([]);
        setBreakdown(null);
        return;
      }
    } catch (e) {
      console.warn('Could not fetch AI questions:', e);
    } finally {
      setIsGeneratingQuestions(false);
    }

    if (!isManual && questions && questions.length > 0) {
      setActiveQuestions(questions);
    }
  };

  useEffect(() => {
    setCurrentIdx(0);
    setSelectedOption(null);
    setIsSubmitted(false);
    setAnswersLog([]);
    setBreakdown(null);
    fetchAiQuestions(false);
  }, [concept.id, studentInterest]);

  const handleFetchAiQuestions = () => {
    fetchAiQuestions(true);
  };

  // Auto-redirect to YouTube preference (default ON, stored in localStorage)
  const [autoRedirectYT, setAutoRedirectYT] = useState<boolean>(() => {
    const saved = localStorage.getItem('adaptive_auto_redirect_yt');
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleAutoRedirect = (enabled: boolean) => {
    setAutoRedirectYT(enabled);
    localStorage.setItem('adaptive_auto_redirect_yt', String(enabled));
  };

  // State for in-app video modal in the final summary
  const [activeSummaryVideoEmbed, setActiveSummaryVideoEmbed] = useState<string | null>(null);

  // Struggle detection states
  const [secondsSpent, setSecondsSpent] = useState(0);
  const [optionChangeCount, setOptionChangeCount] = useState(0);
  const [struggleDetected, setStruggleDetected] = useState(false);
  const [struggleReason, setStruggleReason] = useState('');

  // Assessment results
  const [breakdown, setBreakdown] = useState<MasteryBreakdown | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentQ = activeQuestions[currentIdx] || activeQuestions[0] || questions[0];

  // Start timer on question load
  useEffect(() => {
    setSecondsSpent(0);
    setOptionChangeCount(0);
    setStruggleDetected(false);
    setStruggleReason('');
    setSelectedOption(null);
    setIsSubmitted(false);
    setShowHint(false);

    timerRef.current = setInterval(() => {
      setSecondsSpent((prev) => {
        const next = prev + 1;
        if (next >= 35 && !struggleDetected) {
          setStruggleDetected(true);
          setStruggleReason('Extended conceptual hesitation (>35s response time)');
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIdx, concept.id, activeQuestions]);

  const handleSelectOption = (idx: number) => {
    if (isSubmitted) return;
    if (selectedOption !== null && selectedOption !== idx) {
      const newChanges = optionChangeCount + 1;
      setOptionChangeCount(newChanges);
      if (newChanges >= 2 && !struggleDetected) {
        setStruggleDetected(true);
        setStruggleReason('Multiple option reversals (uncertainty on conceptual boundary)');
      }
    }
    setSelectedOption(idx);
  };

  const handleSubmitAnswer = () => {
    if (selectedOption === null) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSubmitted(true);

    const isCorrect = selectedOption === currentQ.correctIndex;
    const newLog: AnswerLogEntry[] = [
      ...answersLog,
      {
        question: currentQ,
        selectedOption,
        isCorrect,
        timeSeconds: secondsSpent,
      },
    ];
    setAnswersLog(newLog);
  };

  const handleFinalizeAssessment = () => {
    const correctCount = answersLog.filter((a) => a.isCorrect).length;
    const recentAccuracy = Math.round((correctCount / answersLog.length) * 100);
    const historicalAccuracy = concept.masteryScore || 70;
    const avgTime = Math.round(
      answersLog.reduce((acc, cur) => acc + cur.timeSeconds, 0) / answersLog.length
    );

    const prereqScores = concept.prerequisites.map(
      (pid) => allConcepts.find((c) => c.id === pid)?.masteryScore || 100
    );

    const isLastCorrect =
      answersLog.length > 0 ? answersLog[answersLog.length - 1].isCorrect : false;

    const calculated = calculateMastery({
      recentAccuracy,
      historicalAccuracy,
      timeSpentSeconds: avgTime,
      optionChangesCount: optionChangeCount,
      confidenceLevel: confidence,
      prerequisiteScores: prereqScores,
      consecutiveFailures: isLastCorrect ? 0 : 2,
      currentStrategy,
      conceptTitle: concept.title,
      answers: answersLog.map((a) => ({
        isCorrect: a.isCorrect,
        bloomsLevel: a.question.bloomsLevel,
        timeSeconds: a.timeSeconds,
      })),
    });

    setBreakdown(calculated);
    onUpdateConceptMastery(concept.id, calculated);

    // Persist attempt to MySQL for growth dashboard telemetry
    if (userId) {
      apiFetch('/api/quiz/submit-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          conceptId: concept.id,
          conceptTitle: concept.title,
          subject: concept.subject,
          score: calculated.finalScore,
          accuracy: recentAccuracy,
          isMastered: calculated.finalScore >= 80 || (calculated.bktMastery ?? 0.5) >= 0.85,
          timeSpent: avgTime * answersLog.length,
          bktMastery: calculated.bktMastery ?? 0.5,
          answers: answersLog.map((a) => ({
            questionId: a.question.id,
            selectedOption: a.selectedOption,
            correctOption: a.question.correctIndex,
            isCorrect: a.isCorrect,
            bloomsLevel: a.question.bloomsLevel,
            timeSeconds: a.timeSeconds,
          })),
          bloomsBreakdown: calculated.bloomsBreakdown,
        }),
      }).then(res => {
        if (!res.ok) throw new Error('API request failed');
        return res;
      }).catch((err) => console.warn('Failed to sync quiz attempt to DB:', err));
    }

    // Fetch NCERT Curriculum Graph Next-Concept Recommendations
    try {
      apiFetch(`/api/models/recommendations/${encodeURIComponent(concept.title)}`)
        .then((res) => {
          if (!res.ok) throw new Error('API request failed');
          return res.json();
        })
        .then((data) => {
          if (data.success && data.recommendations?.next_recommended_concepts) {
            setNcertRecommendations(data.recommendations.next_recommended_concepts);
          }
        })
        .catch((e) => console.warn('Could not fetch recommendations:', e));
    } catch {}
  };

  const handleNextQuestion = () => {
    if (currentIdx < activeQuestions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const handleResetQuiz = () => {
    setCurrentIdx(0);
    setAnswersLog([]);
    setBreakdown(null);
    setSelectedOption(null);
    setIsSubmitted(false);
    setActiveSummaryVideoEmbed(null);
  };

  const missedQuestions = answersLog.filter((a) => !a.isCorrect);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Assessment Header */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-sans font-medium text-stone-500 uppercase tracking-wider">
            Mastery Evaluation
          </span>
          <h2 className="text-lg font-serif font-semibold text-stone-900 mt-0.5">
            {concept.title}
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Practice questions • Video hints available
          </p>
        </div>

        {/* Live Hesitation, YouTube Auto-Redirect Toggle & Question Counter */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* YouTube Auto-Redirect Preference Button */}
          <button
            id="btn-toggle-yt-redirect-header"
            type="button"
            onClick={() => handleToggleAutoRedirect(!autoRedirectYT)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-stone-400 ${
              autoRedirectYT
                ? 'bg-red-50/90 border-red-200 text-red-700 hover:bg-red-100'
                : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
            }`}
            title="Toggle whether to automatically open YouTube video reference when an answer is incorrect"
          >
            <Youtube className={`w-3.5 h-3.5 ${autoRedirectYT ? 'text-red-600 fill-current' : 'text-stone-500'}`} />
            <span className="hidden sm:inline">Auto-Redirect:</span>
            <span className="font-semibold">{autoRedirectYT ? 'ON' : 'OFF'}</span>
          </button>

          {/* Dynamic AI Questions Generator Button */}
          <button
            id="btn-regen-ai-questions"
            type="button"
            onClick={handleFetchAiQuestions}
            disabled={isGeneratingQuestions}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-medium transition-all shadow-2xs cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-stone-400"
            title="Generate fresh practice questions tailored to your interests"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingQuestions ? 'animate-spin text-emerald-600' : 'text-stone-500'}`} />
            <span className="hidden sm:inline">AI Questions:</span>
            <span className="font-semibold">{isGeneratingQuestions ? 'Generating...' : 'Refresh'}</span>
          </button>

          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${
              secondsSpent > 35
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-stone-50 border-stone-200 text-stone-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-stone-500" />
            <span>{secondsSpent}s</span>
          </div>

          <div className="text-xs font-medium bg-stone-100 text-stone-800 px-3 py-1.5 rounded-lg border border-stone-200">
            {currentIdx + 1} of {activeQuestions.length}
          </div>
        </div>
      </div>

      {/* Real-Time Struggle Detection Alert */}
      {struggleDetected && !breakdown && (
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950 shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-amber-900">
                Cognitive Hesitation Detected
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">{struggleReason}</p>
              <p className="text-[11px] text-amber-700/80 mt-0.5">
                The engine offers hints, Socratic guidance, and video references so you never stay stuck.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenTutorWithStruggle(concept.title, struggleReason)}
            className="shrink-0 px-3 py-1.5 bg-amber-900 hover:bg-amber-950 text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" /> Ask AI Tutor
          </button>
        </div>
      )}

      {/* Question Card */}
      {!breakdown ? (
        !currentQ ? (
          <div className="bg-white rounded-xl border border-stone-200/90 p-8 shadow-2xs text-center space-y-3">
            <RefreshCw className="w-6 h-6 mx-auto text-emerald-600 animate-spin" />
            <p className="text-sm font-medium text-stone-700">Loading personalized assessment questions...</p>
            <p className="text-xs text-stone-400">Contextualizing Bloom's taxonomy with {studentInterest}</p>
          </div>
        ) : (
        <div className="bg-white rounded-xl border border-stone-200/90 p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-400 font-medium">
              <div className="flex items-center gap-2">
                <span>{currentQ.conceptTitle}</span>
                <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                  <Brain className="w-3 h-3 text-indigo-600" />
                  <span>Bloom's: {currentQ.bloomsLevel || (currentIdx === 0 ? 'Recall' : currentIdx === 1 ? 'Application' : 'Analysis')}</span>
                </span>
              </div>
              <span className="px-2 py-0.5 bg-stone-100 rounded text-stone-600 font-medium text-[11px]">
                {currentQ.difficulty}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-serif font-semibold text-stone-900 leading-snug">
              <MathView text={currentQ.text} />
            </h3>
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              let optionStyle = 'border-stone-200/90 hover:border-stone-300 bg-white text-stone-800';

              if (isSubmitted) {
                if (idx === currentQ.correctIndex) {
                  optionStyle = 'border-emerald-600 bg-emerald-50/60 text-emerald-950 font-medium';
                } else if (isSelected) {
                  optionStyle = 'border-rose-300 bg-rose-50/60 text-rose-950';
                }
              } else if (isSelected) {
                optionStyle = 'border-stone-900 bg-stone-50/70 text-stone-950 font-medium shadow-2xs';
              }

              return (
                <div
                  key={idx}
                  id={`quiz-option-${idx}`}
                  onClick={() => handleSelectOption(idx)}
                  className={`p-4 rounded-xl border text-xs sm:text-sm transition-all cursor-pointer flex items-start gap-3.5 ${optionStyle}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-serif font-medium shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <span className="leading-relaxed font-sans">
                    <MathView text={opt} />
                  </span>
                </div>
              );
            })}
          </div>

          {/* Confidence & Hint Bar */}
          {!isSubmitted && (
            <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-stone-500 font-medium">Confidence:</span>
                <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200/60">
                  {(['Low', 'Medium', 'High'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      id={`btn-confidence-${lvl.toLowerCase()}`}
                      type="button"
                      onClick={() => setConfidence(lvl)}
                      className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-stone-400 ${
                        confidence === lvl
                          ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hint toggle */}
              <button
                id="btn-toggle-hint"
                type="button"
                onClick={() => setShowHint(!showHint)}
                className="text-xs text-stone-600 hover:text-stone-900 font-medium flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400 rounded px-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{showHint ? 'Hide Hint' : 'Need a Hint?'}</span>
              </button>
            </div>
          )}

          {/* Hint popup */}
          {showHint && !isSubmitted && (
            <div className="p-4 bg-stone-50 rounded-lg border border-stone-200 text-xs text-stone-700 leading-relaxed animate-in fade-in">
              <strong className="text-stone-900">Hint:</strong> <MathView text={currentQ.hint} />
            </div>
          )}

          {/* Explanation after submission */}
          {isSubmitted && (
            <div
              className={`p-4 rounded-lg border text-xs leading-relaxed space-y-1 ${
                selectedOption === currentQ.correctIndex
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50/80 border-rose-200 text-rose-950'
              }`}
            >
              <div className="flex items-center gap-1.5 font-medium">
                {selectedOption === currentQ.correctIndex ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Correct conceptual understanding.</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Let's review this concept together.</span>
                  </>
                )}
              </div>
              <p>
                <MathView text={currentQ.explanation} />
              </p>
            </div>
          )}

          {/* Coordinated AI Socratic Guidance & YouTube Remediation on Wrong Answer */}
          {isSubmitted && selectedOption !== null && selectedOption !== currentQ.correctIndex && (
            <MCQRemediationGuidance
              question={currentQ}
              selectedOptionIndex={selectedOption}
              autoRedirectEnabled={autoRedirectYT}
              onToggleAutoRedirect={handleToggleAutoRedirect}
              studentInterest={studentInterest}
            />
          )}

          {/* Next / Submit / View Summary Button */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            {isSubmitted && (
              <p className="text-xs text-stone-500">
                {selectedOption === currentQ.correctIndex
                  ? 'Great job! Advance when ready.'
                  : 'Review the video reference above before proceeding.'}
              </p>
            )}

            <div className="ml-auto">
              {!isSubmitted ? (
                <button
                  id="btn-submit-answer"
                  onClick={handleSubmitAnswer}
                  disabled={selectedOption === null}
                  className="py-2.5 px-6 bg-[#114B43] hover:bg-[#0D3F38] disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-lg text-xs font-medium transition-all shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#114B43] focus:ring-offset-1"
                >
                  Submit Answer
                </button>
              ) : currentIdx < activeQuestions.length - 1 ? (
                <button
                  id="btn-next-question"
                  onClick={handleNextQuestion}
                  className="py-2.5 px-6 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-all flex items-center gap-2 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-1"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  id="btn-finalize-assessment"
                  onClick={handleFinalizeAssessment}
                  className="py-2.5 px-6 bg-[#114B43] hover:bg-[#0D3F38] text-white rounded-lg text-xs font-medium transition-all flex items-center gap-2 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#114B43] focus:ring-offset-1"
                >
                  <span>View Complete Mastery Summary</span>
                  <Award className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        )
      ) : (
        /* Final Assessment Mastery & Decision Engine Result */
        <div className="bg-white rounded-xl border border-stone-200/90 p-6 sm:p-8 shadow-2xs space-y-6 animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-[#114B43]" />
              <h3 className="text-lg font-serif font-semibold text-stone-900">
                Mastery Evaluation Summary
              </h3>
            </div>
            <span
              className={`text-xs font-medium px-3 py-1 rounded-md uppercase tracking-wide ${
                breakdown.recommendation === 'advance'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : breakdown.recommendation === 'change_strategy'
                  ? 'bg-stone-100 text-stone-800 border border-stone-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              Action: {breakdown.recommendation.replace('_', ' ')}
            </span>
          </div>

          {/* Calculated Mastery Score Banner */}
          <div className="p-6 rounded-xl bg-[#1C1917] text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-medium text-emerald-400 uppercase tracking-wider bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 flex items-center gap-1">
                  <Brain className="w-3 h-3 text-emerald-400" />
                  <span>Estimated Topic Mastery: {((breakdown.bktMastery ?? (breakdown.finalScore / 100)) * 100).toFixed(1)}%</span>
                </span>
              </div>
              <div className="text-4xl sm:text-5xl font-serif font-semibold text-white tracking-tight">
                {breakdown.finalScore}%
              </div>
              <p className="text-xs text-stone-300 max-w-md mt-1 leading-relaxed">
                Evaluated based on your accuracy, consistency, response timing, and performance across recent practice questions.
              </p>
            </div>

            <div className="w-24 h-24 rounded-full border-2 border-emerald-500/40 flex flex-col items-center justify-center bg-stone-900/80 shrink-0 text-center p-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-stone-400">Status</span>
              <span className="text-xs font-semibold text-emerald-400">
                {breakdown.finalScore >= 80 ? 'Mastered' : breakdown.finalScore >= 65 ? 'Proficient' : 'Review Needed'}
              </span>
              <span className="text-[10px] text-stone-400 font-mono">Target ≥ 80%</span>
            </div>
          </div>

          {/* Mathematical 4-Pillar Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-stone-400 uppercase tracking-wider">
              Performance Factor Breakdown
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-lg bg-stone-50 border border-stone-200/80">
                <span className="text-[11px] font-medium text-stone-500">
                  Recent (40%)
                </span>
                <p className="text-xl font-serif font-semibold text-stone-900 mt-1">
                  {breakdown.recentPerformance}%
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">Quiz accuracy</p>
              </div>

              <div className="p-4 rounded-lg bg-stone-50 border border-stone-200/80">
                <span className="text-[11px] font-medium text-stone-500">
                  Historical (25%)
                </span>
                <p className="text-xl font-serif font-semibold text-stone-900 mt-1">
                  {breakdown.historicalPerformance}%
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">Prior competence</p>
              </div>

              <div className="p-4 rounded-lg bg-stone-50 border border-stone-200/80">
                <span className="text-[11px] font-medium text-stone-500">
                  Behaviour (20%)
                </span>
                <p className="text-xl font-serif font-semibold text-stone-900 mt-1">
                  {breakdown.responseBehaviour}%
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">Hesitation score</p>
              </div>

              <div className="p-4 rounded-lg bg-stone-50 border border-stone-200/80">
                <span className="text-[11px] font-medium text-stone-500">
                  Confidence (15%)
                </span>
                <p className="text-xl font-serif font-semibold text-stone-900 mt-1">
                  {breakdown.confidenceScore}%
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">Self-assessed</p>
              </div>
            </div>
          </div>

          {/* Bloom's Cognitive Taxonomy Breakdown Card */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-indigo-500" />
              Skill & Question Type Breakdown
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-lg bg-indigo-50/50 border border-indigo-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-indigo-900">Core Recall</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">Definitions</span>
                </div>
                <p className="text-xl font-serif font-semibold text-indigo-950 mt-1">
                  {breakdown.bloomsBreakdown?.recallAccuracy ?? breakdown.recentPerformance}%
                </p>
                <p className="text-[10px] text-indigo-600/80 mt-0.5">Foundational recall & formula retention</p>
              </div>

              <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-emerald-900">Practical Application</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Problems</span>
                </div>
                <p className="text-xl font-serif font-semibold text-emerald-950 mt-1">
                  {breakdown.bloomsBreakdown?.applicationAccuracy ?? breakdown.recentPerformance}%
                </p>
                <p className="text-[10px] text-emerald-600/80 mt-0.5">Applied real-world context ({studentInterest})</p>
              </div>

              <div className="p-4 rounded-lg bg-amber-50/50 border border-amber-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-amber-900">Multi-Step Analysis</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Deduction</span>
                </div>
                <p className="text-xl font-serif font-semibold text-amber-950 mt-1">
                  {breakdown.bloomsBreakdown?.analysisAccuracy ?? breakdown.recentPerformance}%
                </p>
                <p className="text-[10px] text-amber-600/80 mt-0.5">Edge cases, derivations & boundary testing</p>
              </div>
            </div>
          </div>

          {/* Decision Engine Assessment */}
          <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 text-stone-900 space-y-1">
            <h5 className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 text-stone-700">
              <Sparkles className="w-3.5 h-3.5 text-stone-500" />
              Learning Recommendation
            </h5>
            <p className="text-xs text-stone-600 leading-relaxed">{breakdown.reason}</p>
          </div>

          {/* YouTube Video Review for Missed Questions Section */}
          {missedQuestions.length > 0 && (
            <div className="p-5 rounded-xl border-2 border-red-200 bg-linear-to-b from-red-50/50 to-white space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center">
                    <Youtube className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-700">
                      Video Explanations for Missed Questions ({missedQuestions.length})
                    </h4>
                    <p className="text-xs text-stone-600">
                      Watch targeted video explanations for each question you missed to strengthen your understanding.
                    </p>
                  </div>
                </div>

                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                    concept.title + ' tutorial Khan Academy'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-red-700 hover:text-red-900 font-semibold flex items-center gap-1"
                >
                  <span>Open Full Topic on YouTube</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="space-y-3 pt-1">
                {missedQuestions.map((item, idx) => {
                  const yt = getYouTubeReferenceForQuestion(
                    item.question,
                    item.question.options[item.selectedOption]
                  );
                  const isPlayingEmbed = activeSummaryVideoEmbed === item.question.id;

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-lg border border-stone-200 bg-white space-y-2.5 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                            Question {idx + 1}: {yt.channelName}
                          </span>
                          <h5 className="text-xs font-medium text-stone-900 mt-1">
                            <MathView text={item.question.text} />
                          </h5>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-950">
                          <span className="font-semibold text-rose-700">Your Answer: </span>
                          <MathView text={item.question.options[item.selectedOption]} />
                        </div>
                        <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-950">
                          <span className="font-semibold text-emerald-700">Correct Target: </span>
                          <MathView text={item.question.options[item.question.correctIndex]} />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-xs font-medium text-stone-700 truncate max-w-sm">
                          Video: {yt.videoTitle}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSummaryVideoEmbed(isPlayingEmbed ? null : item.question.id)
                            }
                            className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Play className="w-3 h-3 text-stone-600" />
                            <span>{isPlayingEmbed ? 'Hide Video' : 'Watch In-App'}</span>
                          </button>

                          <a
                            href={yt.directUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                          >
                            <Youtube className="w-3.5 h-3.5 fill-white" />
                            <span>Watch on YouTube</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      {/* Embedded Player in Summary */}
                      {isPlayingEmbed && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-stone-300 aspect-video bg-black">
                          <iframe
                            src={yt.embedUrl}
                            title={yt.videoTitle}
                            aria-label={`YouTube video player: ${yt.videoTitle}`}
                            className="w-full h-full border-0 focus:outline-none focus:ring-2 focus:ring-stone-400"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NCERT Curriculum Graph Next Concept Recommendations */}
          {ncertRecommendations.length > 0 && (
            <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-emerald-100 text-emerald-800">
                    <Sparkles className="w-4 h-4 text-emerald-700" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                      Recommended Next Concepts (NCERT Curriculum Graph)
                    </h4>
                    <p className="text-[11px] text-stone-600">
                      Precomputed pedagogical pathways derived from the 29,000-node NCERT prerequisite network.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-200/60 text-emerald-900 border border-emerald-300">
                  {ncertRecommendations.length} Pathways
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {ncertRecommendations.slice(0, 3).map((recTitle, idx) => {
                  const matchingConcept = allConcepts.find(
                    (c) => c.title.toLowerCase() === recTitle.toLowerCase() ||
                           recTitle.toLowerCase().includes(c.title.toLowerCase())
                  );

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (matchingConcept) onNavigateToConcept(matchingConcept.id);
                      }}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        matchingConcept
                          ? 'border-emerald-300 bg-white hover:border-emerald-500 hover:shadow-xs cursor-pointer'
                          : 'border-stone-200 bg-white/80 opacity-90'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-stone-400 mb-1">
                        <span>Pathway #{idx + 1}</span>
                        {matchingConcept && (
                          <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                            In Syllabus <ArrowRight className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-stone-900 leading-snug line-clamp-2">
                        {recTitle}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <button
              id="btn-retake-quiz"
              onClick={handleResetQuiz}
              className="py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-stone-400"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retake Check
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {breakdown.recommendation === 'step_back' && concept.prerequisites.length > 0 && (
                <button
                  id="btn-goto-prerequisite"
                  onClick={() => onNavigateToConcept(concept.prerequisites[0])}
                  className="py-2.5 px-4 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Review Prerequisite
                </button>
              )}

              {breakdown.recommendation === 'change_strategy' && (
                <button
                  id="btn-change-strategy-rec"
                  onClick={() => {
                    const next = getNextRecommendedStrategy(currentStrategy);
                    onChangeStrategy(next);
                  }}
                  className="py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-1"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Switch Strategy to {getNextRecommendedStrategy(currentStrategy)}
                </button>
              )}

              {breakdown.recommendation === 'advance' && (
                <button
                  id="btn-advance-next-concept"
                  onClick={() => {
                    const nextConcept = allConcepts.find(
                      (c) => c.status === 'in_progress' || c.status === 'locked'
                    );
                    if (nextConcept) onNavigateToConcept(nextConcept.id);
                  }}
                  className="py-2.5 px-5 bg-[#114B43] hover:bg-[#0D3F38] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#114B43] focus:ring-offset-1"
                >
                  <span>Advance to Next Topic</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
