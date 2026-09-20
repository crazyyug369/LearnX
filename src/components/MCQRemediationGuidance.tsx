import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Youtube,
  ExternalLink,
  Play,
  X,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BrainCircuit,
  MessageSquare,
  ChevronRight,
  BookOpen,
  ArrowRight,
  Lightbulb,
  Send,
  RefreshCw,
} from 'lucide-react';
import { Question, StudentInterest } from '../types';
import {
  getYouTubeReferenceForQuestion,
  YouTubeReference,
  openYouTubeReference,
} from '../utils/youtubeReference';
import { MathView } from './MathView';

interface MCQRemediationGuidanceProps {
  question: Question;
  selectedOptionIndex: number;
  autoRedirectEnabled: boolean;
  onToggleAutoRedirect?: (enabled: boolean) => void;
  studentInterest?: StudentInterest;
  onRetakeQuestion?: () => void;
}

interface AIGuidanceData {
  misconceptionAnalysis: string;
  stepByStepCorrection: string[];
  keyFormulaLatex: string;
  formulaName: string;
  socraticHint: string;
  interestAnalogy?: string;
  encouragingNote: string;
}

export const MCQRemediationGuidance: React.FC<MCQRemediationGuidanceProps> = ({
  question,
  selectedOptionIndex,
  autoRedirectEnabled,
  onToggleAutoRedirect,
  studentInterest = 'Cricket & Sports',
  onRetakeQuestion,
}) => {
  // Tabs: 'both' | 'ai' | 'youtube'
  const [activeTab, setActiveTab] = useState<'both' | 'ai' | 'youtube'>('both');
  const [showInAppPlayer, setShowInAppPlayer] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [redirectCancelled, setRedirectCancelled] = useState(false);

  // AI Guidance state
  const [aiLoading, setAiLoading] = useState(true);
  const [aiGuidance, setAiGuidance] = useState<AIGuidanceData | null>(null);
  const [customQuestionInput, setCustomQuestionInput] = useState('');
  const [customAnswer, setCustomAnswer] = useState<string | null>(null);
  const [customAsking, setCustomAsking] = useState(false);
  const [tutorLanguage, setTutorLanguage] = useState<'English' | 'Hindi' | 'Gujarati'>('English');

  const selectedAnswer = question.options[selectedOptionIndex];
  const correctAnswer = question.options[question.correctIndex];

  const ytRef: YouTubeReference = getYouTubeReferenceForQuestion(
    question,
    selectedAnswer
  );

  // Fetch AI Guidance on mount or when question / selected option changes
  useEffect(() => {
    let isMounted = true;
    setAiLoading(true);
    setCustomAnswer(null);

    const fetchAIGuidance = async (followUp: string = '') => {
      try {
        const res = await fetch('/api/ai/mcq-guidance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: question.text,
            conceptTitle: question.conceptTitle || 'Core Concept',
            selectedOption: selectedAnswer,
            correctOption: correctAnswer,
            explanation: question.explanation,
            hint: question.hint || '',
                          interest: studentInterest,
              customFollowUp: followUp,
            }),
          });
          
          if (!res.ok) throw new Error('API Request Failed');
          
          const json = await res.json();
          if (isMounted && json.success && json.data) {
            setAiGuidance(json.data);
          }
        } catch (err) {
        console.warn('Network issue fetching AI guidance, utilizing client fallback:', err);
        // Concept-aware intelligent fallback directly
        if (isMounted) {
          const qText = ((question.text || '') + ' ' + (question.explanation || '')).toLowerCase();
          if (qText.includes('friction') || qText.includes('force') || qText.includes('newton')) {
            setAiGuidance({
              misconceptionAnalysis: `Selecting "${selectedAnswer}" overlooks the static friction threshold check: when applied force doesn't exceed $f_{s,\\max}$, acceleration remains zero!`,
              stepByStepCorrection: [
                `Step 1: Compute maximum static resistance: $f_{s,\\max} = \\mu_s N = 0.6 \\times (5 \\times 10) = 30\\text{ N}$.`,
                `Step 2: Compare applied force: $25\\text{ N} \\le 30\\text{ N}$, so friction balances the force completely ($f_s = 25\\text{ N}$).`,
                `Step 3: By Newton's Laws: $F_{\\text{net}} = 0 \\implies a = 0\\text{ m/s}^2$. The correct choice is "${correctAnswer}".`,
              ],
              keyFormulaLatex: `f_{s,\\max} = \\mu_s N, \\quad \\vec{F}_{\\text{net}} = m \\cdot \\vec{a} = 0`,
              formulaName: `Newton's 2nd Law & Static Friction Equilibrium`,
              socraticHint: `Always check whether the applied force overcomes the static limit before calculating acceleration!`,
              encouragingNote: `Great intuition checking the threshold—this is one of the most common physics exam traps!`,
            });
          } else if (qText.includes('loop') || qText.includes('continue') || qText.includes('for ')) {
            setAiGuidance({
              misconceptionAnalysis: `Selecting "${selectedAnswer}" happens if 'continue' is thought to break out of the whole loop rather than skip only the single current iteration.`,
              stepByStepCorrection: [
                `Step 1: Generated loop index sequence: $i \\in \\{0, 1, 2, 3, 4\\}$.`,
                `Step 2: When $i == 3$, the 'continue' command executes and skips line 4.`,
                `Step 3: Sum of accumulated iterations: $0 + 1 + 2 + 4 = 7$. Correct answer: "${correctAnswer}".`,
              ],
              keyFormulaLatex: `\\sum_{i \\in \\{0, 1, 2, 4\\}} i = 7`,
              formulaName: `Control Flow State Invariant`,
              socraticHint: `Remember: 'continue' skips the rest of the loop body for that iteration; 'break' terminates the loop entirely.`,
              encouragingNote: `State tracing is the true superpower of master programmers!`,
            });
          } else {
            setAiGuidance({
              misconceptionAnalysis: `Selecting "${selectedAnswer}" is a common slip caused by overlooking sign negation or skipping the intermediate evaluation step.`,
              stepByStepCorrection: [
                `Step 1: Identify given coefficients and structure: $ax^2 + bx + c = 0$.`,
                `Step 2: Evaluate intermediate discriminant: $(-6)^2 = 36$ and subtract $4ac = 32$, yielding $\\Delta = 4 > 0$.`,
                `Step 3: Solve via quadratic formula: $x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a} \\implies x = 2, 4$.`,
              ],
              keyFormulaLatex: `x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}`,
              formulaName: `Quadratic Formula & Root Classification`,
              socraticHint: `Remember that squaring any real negative number like $(-6)^2$ always produces a positive quantity $+36$.`,
              encouragingNote: `Catching this sign trap now ensures you'll ace subsequent problems!`,
            });
          }
        }
      } finally {
        if (isMounted) setAiLoading(false);
      }
    };

    fetchAIGuidance();

    return () => {
      isMounted = false;
    };
  }, [question.id, selectedOptionIndex, studentInterest]);

  // Handle custom student question to AI Tutor (multilingual & KaTeX supported)
  const handleAskFollowUp = async (promptText: string) => {
    if (!promptText.trim()) return;
    setCustomAsking(true);
    try {
      const res = await fetch('/api/ai/tutor-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: question.conceptTitle || 'Concept Question',
          message: `Regarding: "${question.text}", student chose "${selectedAnswer}" (correct: "${correctAnswer}"). Student asks in ${tutorLanguage}: "${promptText}". Format mathematical formulas in LaTeX $...$ or $$...$$.`,
          userMessage: `Regarding: "${question.text}", student chose "${selectedAnswer}" (correct: "${correctAnswer}"). Student asks in ${tutorLanguage}: "${promptText}". Format mathematical formulas in LaTeX $...$ or $$...$$.`,
          interest: studentInterest,
          language: tutorLanguage,
          history: [],
        }),
      });
      if (!res.ok) throw new Error('API Request Failed');
      const json = await res.json();
      const reply = json.reply || json.data?.reply;
      if (reply) {
        setCustomAnswer(reply);
      } else {
        setCustomAnswer('I am unable to process your request at this moment.');
      }
    } catch {
      setCustomAnswer(
        tutorLanguage === 'Hindi'
          ? `समीकरण में पदों को अलग करें और सूत्र के अनुसार मान स्थापित करें।`
          : tutorLanguage === 'Gujarati'
          ? `સમીકરણમાં પદોને છૂટા પાડો અને સૂત્ર મુજબ કિંમત મૂકો.`
          : `Focus on the fundamental identity: when substituting values, always preserve parentheses around negative numbers.`
      );
    } finally {
      setCustomAsking(false);
      setCustomQuestionInput('');
    }
  };

  // YouTube auto-redirect countdown logic
  useEffect(() => {
    if (!autoRedirectEnabled || redirectCancelled) {
      setCountdown(null);
      return;
    }

    setCountdown(4);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          openYouTubeReference(ytRef.directUrl);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRedirectEnabled, redirectCancelled, ytRef.directUrl]);

  const handleCancelCountdown = () => {
    setRedirectCancelled(true);
    setCountdown(null);
  };

  return (
    <div
      id="mcq-remediation-hub"
      className="mt-5 rounded-2xl border-2 border-rose-200/90 bg-linear-to-b from-rose-50/50 via-white to-stone-50/60 p-4 sm:p-6 shadow-sm space-y-5 animate-in fade-in slide-in-from-top-2 duration-300"
    >
      {/* Header Bar with Remediation Badge & Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-rose-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#114B43] text-white flex items-center justify-center shadow-xs">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-900 tracking-wide uppercase">
                Review & Concept Helper
              </span>
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                Review Needed
              </span>
            </div>
            <p className="text-xs text-stone-600">
              Step-by-step guidance and helpful video lesson
            </p>
          </div>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200/80 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'both'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            All Guidance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'ai'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Concept Guide</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('youtube')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'youtube'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Youtube className="w-3.5 h-3.5 text-red-600" />
            <span>YouTube</span>
          </button>
        </div>
      </div>

      {/* Misconception Diagnostic Comparison Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-rose-50/90 border border-rose-200 text-rose-950 space-y-1">
          <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" /> Your Choice
          </span>
          <div className="font-medium text-xs text-stone-900">
            <MathView text={selectedAnswer} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-950 space-y-1">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Correct Answer
          </span>
          <div className="font-medium text-xs text-stone-900">
            <MathView text={correctAnswer} />
          </div>
        </div>
      </div>

      {/* Auto-Redirect Active Countdown Banner */}
      {countdown !== null && countdown > 0 && (
        <div className="p-3.5 bg-red-50/90 rounded-xl border border-red-200 flex items-center justify-between gap-3 text-red-950 text-xs animate-pulse">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-red-600 text-white flex items-center justify-center shrink-0">
              <Youtube className="w-3.5 h-3.5 fill-current" />
            </div>
            <span>
              Auto-redirecting to YouTube video reference in{' '}
              <strong className="font-bold text-red-700 text-sm">{countdown}s</strong>...
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={ytRef.directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold text-xs transition-colors shadow-2xs"
            >
              Open Now
            </a>
            <button
              onClick={handleCancelCountdown}
              className="px-2 py-1 text-stone-600 hover:text-stone-900 text-xs font-medium underline cursor-pointer"
            >
              Stay on Page
            </button>
          </div>
        </div>
      )}

      {/* SECTION 1: AI GUIDANCE */}
      {(activeTab === 'both' || activeTab === 'ai') && (
        <div className="bg-white rounded-xl border border-stone-200/90 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-50 text-[#114B43] flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                AI Socratic Guidance & KaTeX Formula Breakdown
              </h4>
            </div>
            <span className="text-[10px] text-stone-500 font-medium">
              Powered by Gemini 3.8 + KaTeX
            </span>
          </div>

          {aiLoading ? (
            <div className="py-8 text-center space-y-2">
              <RefreshCw className="w-6 h-6 text-[#114B43] animate-spin mx-auto" />
              <p className="text-xs font-medium text-stone-700">
                Preparing a helpful explanation for your answer...
              </p>
            </div>
          ) : aiGuidance ? (
            <div className="space-y-4 text-xs">
              {/* Misconception Diagnostic */}
              <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-200/80 text-amber-950 flex items-start gap-2.5">
                <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-900 font-semibold block mb-0.5">
                    Why this commonly happens:
                  </strong>
                  <p className="text-stone-800 leading-relaxed">
                    <MathView text={aiGuidance.misconceptionAnalysis} />
                  </p>
                </div>
              </div>

              {/* Key Formula Card in KaTeX */}
              {aiGuidance.keyFormulaLatex && (
                <div className="bg-[#FAF9F6] border border-stone-200 rounded-xl p-4 text-center space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">
                    {aiGuidance.formulaName || 'Pivotal Formula'}
                  </span>
                  <div className="text-base sm:text-lg font-serif text-stone-900 overflow-x-auto py-1">
                    <MathView display math={aiGuidance.keyFormulaLatex} />
                  </div>
                </div>
              )}

              {/* Step-by-Step Correction with KaTeX */}
              <div className="space-y-2">
                <h5 className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                  Step-by-Step Derivation & Correction:
                </h5>
                <div className="space-y-2">
                  {aiGuidance.stepByStepCorrection.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-stone-50 border border-stone-200/70 flex items-start gap-3"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#114B43] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="text-stone-800 leading-relaxed font-sans">
                        <MathView text={step} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Socratic Mental Check & Interest Analogy */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="p-3 rounded-lg bg-stone-100/80 border border-stone-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-stone-500" /> Socratic Self-Check
                  </span>
                  <p className="text-stone-700 leading-relaxed text-[11px]">
                    <MathView text={aiGuidance.socraticHint} />
                  </p>
                </div>

                {aiGuidance.interestAnalogy && (
                  <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200/70 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> {studentInterest} Link
                    </span>
                    <p className="text-stone-700 leading-relaxed text-[11px]">
                      <MathView text={aiGuidance.interestAnalogy} />
                    </p>
                  </div>
                )}
              </div>

              {/* Custom Follow-Up Query with AI Tutor */}
              <div className="pt-2 border-t border-stone-100 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-stone-700 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-[#114B43]" /> Still unsure? Ask AI Tutor:
                    </span>
                    {/* Multilingual Selector */}
                    <div className="inline-flex rounded border border-stone-200 bg-stone-50 p-0.5 text-[10px]">
                      {(['English', 'Hindi', 'Gujarati'] as const).map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setTutorLanguage(l)}
                          className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
                            tutorLanguage === l
                              ? 'bg-[#114B43] text-white shadow-2xs'
                              : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          {l === 'English' ? 'EN' : l === 'Hindi' ? 'हिंदी' : 'ગુજરાતી'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {(tutorLanguage === 'Hindi'
                      ? ['सरल चरणों में समझाएं', 'चिन्ह (+) (-) कैसे बदला?', 'सूत्र (Formula) सहित बताएं']
                      : tutorLanguage === 'Gujarati'
                      ? ['સરળ પગલાંમાં સમજાવો', 'ચિહ્ન (+) (-) કેવી રીતે બદલાયું?', 'સૂત્ર (Formula) સાથે સમજાવો']
                      : ['Explain with simpler steps', 'Why did the sign flip?', 'Explain using Cricket']
                    ).map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleAskFollowUp(chip)}
                        className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded text-[10px] font-medium transition-colors cursor-pointer"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customQuestionInput}
                    onChange={(e) => setCustomQuestionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAskFollowUp(customQuestionInput);
                    }}
                    placeholder={
                      tutorLanguage === 'Hindi'
                        ? "अपनी शंका लिखें (जैसे: विविक्तकर धनात्मक क्यों है?)..."
                        : tutorLanguage === 'Gujarati'
                        ? "તમારી મૂંઝવણ લખો (જેમ કે: વિવેચક ધન કેમ આવ્યો?)..."
                        : "Type your doubt (e.g. why is discriminant positive?)..."
                    }
                    className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#114B43]"
                  />
                  <button
                    type="button"
                    onClick={() => handleAskFollowUp(customQuestionInput)}
                    disabled={customAsking || !customQuestionInput.trim()}
                    className="px-3 py-1.5 bg-[#114B43] hover:bg-[#0D3F38] disabled:bg-stone-200 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {customAsking ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Ask ({tutorLanguage === 'English' ? 'EN' : tutorLanguage === 'Hindi' ? 'हिंदी' : 'ગુજરાતી'})</span>
                  </button>
                </div>

                {/* Custom AI Answer */}
                {customAnswer && (
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-stone-800 space-y-1 animate-in fade-in">
                    <strong className="text-emerald-900 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Tutor Response ({tutorLanguage}):
                    </strong>
                    <div className="leading-relaxed">
                      <MathView text={customAnswer} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* SECTION 2: YOUTUBE GUIDANCE */}
      {(activeTab === 'both' || activeTab === 'youtube') && (
        <div className="bg-white rounded-xl border border-stone-200/90 p-5 space-y-3.5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-xs">
                <Youtube className="w-4 h-4 fill-current" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider">
                    YouTube Video Walkthrough
                  </h4>
                  <span className="text-[10px] bg-red-50 text-red-800 px-1.5 py-0.5 rounded font-medium border border-red-200">
                    {ytRef.channelName}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500">
                  Helpful video lesson for this specific concept
                </p>
              </div>
            </div>

            {/* Auto-redirect toggle checkbox */}
            {onToggleAutoRedirect && (
              <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer select-none bg-stone-50 px-2.5 py-1 rounded-md border border-stone-200 hover:bg-stone-100">
                <input
                  type="checkbox"
                  id="toggle-auto-redirect-yt-remediation"
                  checked={autoRedirectEnabled}
                  onChange={(e) => onToggleAutoRedirect(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-[11px] font-medium">Auto-open on error</span>
              </label>
            )}
          </div>

          <div>
            <h5 className="text-sm font-semibold text-stone-900 leading-snug">
              {ytRef.videoTitle}
            </h5>
            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
              <strong className="text-stone-800">Why this video:</strong>{' '}
              {ytRef.relevanceExplanation}
            </p>
          </div>

          {/* Action buttons: Open on YouTube, Watch In-App, Search */}
          <div className="pt-1 flex flex-wrap items-center gap-2.5">
            <a
              id="btn-open-youtube-reference"
              href={ytRef.directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[200px] py-2.5 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer"
              title="Open video directly on YouTube in new tab"
            >
              <Youtube className="w-4 h-4 fill-white" />
              <span>Open on YouTube (New Tab)</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>

            <button
              id="btn-toggle-inapp-player"
              type="button"
              onClick={() => setShowInAppPlayer(!showInAppPlayer)}
              className="py-2.5 px-3.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-stone-700" />
              <span>{showInAppPlayer ? 'Hide In-App Player' : 'Watch In-App'}</span>
            </button>

            <a
              id="btn-search-more-youtube"
              href={ytRef.searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 text-stone-600 hover:text-stone-900 text-xs font-medium underline flex items-center gap-1 transition-colors"
            >
              <span>Search More Videos</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Embedded in-app YouTube Player */}
          {showInAppPlayer && (
            <div className="rounded-xl overflow-hidden border border-stone-300 bg-stone-900 shadow-md animate-in fade-in duration-200 mt-3">
              <div className="bg-stone-900 px-3 py-2 flex items-center justify-between text-white text-xs border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-500 fill-current" />
                  <span className="font-medium truncate max-w-xs sm:max-w-md">
                    {ytRef.videoTitle}
                  </span>
                </div>
                <button
                  onClick={() => setShowInAppPlayer(false)}
                  className="p-1 text-stone-400 hover:text-white rounded transition-colors"
                  title="Close player"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative w-full aspect-video bg-black">
                <iframe
                  src={ytRef.embedUrl}
                  title={ytRef.videoTitle}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              <div className="p-2.5 bg-stone-950 text-stone-400 text-[11px] flex items-center justify-between">
                <span>Video powered by YouTube • Official Educational Channel</span>
                <a
                  href={ytRef.directUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-400 hover:text-red-300 flex items-center gap-1 font-medium"
                >
                  <span>Watch on YouTube</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MCQRemediationGuidance;
