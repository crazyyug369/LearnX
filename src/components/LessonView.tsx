import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  RefreshCw,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Terminal,
  Calculator,
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { ConceptNode, StudentInterest, TeachingStrategy, LessonContent } from '../types';
import { MathView } from './MathView';

interface LessonViewProps {
  concept: ConceptNode;
  interest: StudentInterest;
  strategy: TeachingStrategy;
  onChangeStrategy: (strategy: TeachingStrategy) => void;
  onProceedToAssessment: (conceptId: string) => void;
  ttsEnabled: boolean;
}

export const LessonView: React.FC<LessonViewProps> = ({
  concept,
  interest,
  strategy,
  onChangeStrategy,
  onProceedToAssessment,
  ttsEnabled,
}) => {
  const [loading, setLoading] = useState(false);
  const [lesson, setLesson] = useState<LessonContent | null>(null);
  const [showCheckAnswer, setShowCheckAnswer] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const strategies: TeachingStrategy[] = [
    'Analogy & Real-world',
    'Socratic / Guided Inquiry',
    'Step-by-Step Visual',
    'First Principles',
  ];

  const fetchLesson = async () => {
    setLoading(true);
    setShowCheckAnswer(false);
    setFeedback(null);
    try {
      const res = await fetch('/api/ai/adaptive-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: concept.title,
          subject: concept.subject,
          interest,
          strategy,
          difficulty: concept.difficulty,
          prerequisite: concept.prerequisites.length > 0 ? concept.prerequisites.join(', ') : '',
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || json?.message || 'We could not load this lesson.');
      }
      setLesson(json.data);
      setFeedback({ type: 'success', message: 'Personalized lesson ready.' });
    } catch (err: any) {
      console.error('Failed to load lesson:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'We could not load the lesson. Check your connection and try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLesson();
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    };
  }, [concept.id, interest, strategy]);

  const handleToggleSpeech = () => {
    if (!ttsEnabled) {
      setFeedback({ type: 'error', message: 'Audio is disabled for this lesson.' });
      return;
    }
    if (!('speechSynthesis' in window)) {
      setFeedback({ type: 'error', message: 'Audio playback is not supported in this browser.' });
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else if (lesson) {
      const textToRead = `${lesson.title}. ${lesson.coreConcept}. Analogy: ${lesson.interestAnalogy}. Key takeaways: ${lesson.keyTakeaways.join('. ')}. Example: ${lesson.microExample}`;
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  const copyTextWithFallback = async (text: string) => {
    if (!text.trim()) throw new Error('There is no lesson text to copy yet.');

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // Fall through to the textarea fallback for older browsers or blocked permissions.
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand?.('copy');
    textarea.remove();
    if (!copied) throw new Error('Copy is unavailable in this browser.');
  };

  const handleCopy = async (section: string, text: string) => {
    try {
      await copyTextWithFallback(text);
      setCopiedSection(section);
      setFeedback({ type: 'success', message: 'Copied to clipboard.' });
      window.setTimeout(() => setCopiedSection((current) => (current === section ? null : current)), 1800);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Could not copy this content.' });
    }
  };

  const lessonCopyText = lesson
    ? [
        lesson.title,
        lesson.coreConcept,
        `Real-world framing (${interest}): ${lesson.interestAnalogy}`,
        'Key takeaways:',
        ...lesson.keyTakeaways.map((takeaway, index) => `${index + 1}. ${takeaway}`),
        `Example:\n${lesson.microExample}`,
        lesson.checkYourUnderstanding
          ? `Quick concept check: ${lesson.checkYourUnderstanding.question}\nHint: ${lesson.checkYourUnderstanding.hint}\nAnswer: ${lesson.checkYourUnderstanding.answer}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    : '';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Modality Bar: Strategy Switcher & Context */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
            Learning Style
          </span>
          <h2 className="text-lg font-serif font-semibold text-stone-900 mt-0.5 flex items-center gap-2">
            <span>{concept.title}</span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-sans font-medium border border-stone-200">
              {concept.difficulty}
            </span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Interest: <span className="font-medium text-stone-800">{interest}</span> • Approach:{' '}
            <span className="font-medium text-stone-800">{strategy}</span>
          </p>
        </div>

        {/* Strategy Switcher Pills */}
        <div className="flex flex-wrap items-center gap-1 bg-stone-100/90 p-1 rounded-lg border border-stone-200/70">
          {strategies.map((strat) => {
            const isSelected = strategy === strat;
            return (
              <button
                type="button"
                key={strat}
                id={`btn-strategy-${strat.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                onClick={() => {
                  setFeedback(null);
                  onChangeStrategy(strat);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#114B43] ${
                  isSelected
                    ? 'bg-[#114B43] text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                }`}
              >
                {strat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Lesson Content Card */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-6 sm:p-9 shadow-2xs relative">
        {feedback && (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            aria-live={feedback.type === 'error' ? 'assertive' : 'polite'}
            className={`mb-4 flex items-start gap-2 rounded-lg border p-3 text-xs ${
              feedback.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {feedback.type === 'error' ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
            {feedback.type === 'error' && !loading && (
              <button
                type="button"
                onClick={fetchLesson}
                className="ml-auto shrink-0 rounded-md px-2 py-1 font-semibold underline underline-offset-2 hover:no-underline focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                Retry
              </button>
            )}
          </div>
        )}
        {/* Header toolbar */}
        <div className="flex items-center justify-between pb-5 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-stone-500" />
            <span className="text-xs font-medium text-stone-600 uppercase tracking-wider">
              Micro-Lesson
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              id="btn-lesson-tts-read"
              type="button"
              onClick={handleToggleSpeech}
              disabled={!lesson || loading || !ttsEnabled}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:cursor-not-allowed disabled:opacity-50 ${
                isSpeaking
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
              title="Listen to lesson"
            >
              {isSpeaking ? <VolumeX className="w-3.5 h-3.5 text-emerald-600" /> : <Volume2 className="w-3.5 h-3.5 text-stone-500" />}
              <span>{isSpeaking ? 'Stop Audio' : 'Listen Aloud'}</span>
            </button>

            <button
              id="btn-refresh-lesson"
              type="button"
              onClick={fetchLesson}
              disabled={loading}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:cursor-not-allowed disabled:opacity-50"
              title="Regenerate explanation"
              aria-label="Regenerate lesson"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-stone-900" aria-hidden="true" /> : <RefreshCw className="w-4 h-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => handleCopy('lesson', lessonCopyText)}
              disabled={!lesson || loading}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Copy lesson content"
            >
              {copiedSection === 'lesson' ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              <span>{copiedSection === 'lesson' ? 'Copied' : 'Copy lesson'}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#114B43] border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <p className="text-sm font-medium text-stone-800">
                Generating personalized explanation...
              </p>
              <p className="text-xs text-stone-400 mt-0.5">
                Customizing lesson examples for {interest}
              </p>
            </div>
          </div>
        ) : lesson ? (
          <div className="space-y-7 pt-6">
            {/* Title & Core Concept */}
            <div className="space-y-3">
              <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-stone-900 tracking-tight leading-snug">
                <MathView text={lesson.title} />
              </h1>
              <div className="text-base text-stone-700 leading-relaxed font-sans">
                <MathView text={lesson.coreConcept} />
              </div>
            </div>

            {/* Interest-Aware Analogy Card */}
            <div className="bg-[#FAF9F6] border border-stone-200/90 rounded-xl p-5 sm:p-6 space-y-2">
              <span className="text-[11px] font-sans font-medium text-stone-500 uppercase tracking-wider">
                Real-World Framing • {interest}
              </span>
              <p className="font-serif italic text-base sm:text-lg text-stone-850 leading-relaxed">
                "<MathView text={lesson.interestAnalogy} />"
              </p>
            </div>

            {/* Formula Reference Card if applicable */}
            {(concept.id === 'math-3' || concept.title.toLowerCase().includes('quadratic')) && (
              <div className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                  <Calculator className="w-4 h-4 text-amber-700" />
                  <span>Key Mathematical Formulas (KaTeX)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3.5 rounded-lg border border-amber-200/60 text-center space-y-1">
                    <span className="text-[10px] uppercase font-bold text-stone-500">
                      Quadratic Formula
                    </span>
                    <div className="text-base font-serif text-stone-900 py-1">
                      <MathView display math="x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}" />
                    </div>
                  </div>
                  <div className="bg-white p-3.5 rounded-lg border border-amber-200/60 text-center space-y-1">
                    <span className="text-[10px] uppercase font-bold text-stone-500">
                      Discriminant & Nature of Roots
                    </span>
                    <div className="text-base font-serif text-stone-900 py-1">
                      <MathView display math="\Delta = b^2 - 4ac" />
                    </div>
                    <p className="text-[10px] text-stone-600">
                      <MathView text="$\Delta > 0$ (2 real), $\Delta = 0$ (1 repeated), $\Delta < 0$ (complex)" />
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(concept.id === 'math-1' || concept.title.toLowerCase().includes('linear')) && (
              <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  <Calculator className="w-4 h-4 text-emerald-700" />
                  <span>Governing Formulas (KaTeX)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3.5 rounded-lg border border-emerald-200/60 text-center space-y-1">
                    <span className="text-[10px] uppercase font-bold text-stone-500">
                      Slope-Intercept Form
                    </span>
                    <div className="text-base font-serif text-stone-900 py-1">
                      <MathView display math="y = mx + c" />
                    </div>
                  </div>
                  <div className="bg-white p-3.5 rounded-lg border border-emerald-200/60 text-center space-y-1">
                    <span className="text-[10px] uppercase font-bold text-stone-500">
                      Gradient / Slope
                    </span>
                    <div className="text-base font-serif text-stone-900 py-1">
                      <MathView display math="m = \frac{y_2 - y_1}{x_2 - x_1} = \frac{\Delta y}{\Delta x}" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(concept.id === 'phy-2' || concept.title.toLowerCase().includes('newton')) && (
              <div className="bg-blue-50/40 border border-blue-200/80 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase tracking-wider">
                  <Calculator className="w-4 h-4 text-blue-700" />
                  <span>Governing Laws of Motion (KaTeX)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3.5 rounded-lg border border-blue-200/60 text-center space-y-1">
                    <span className="text-[10px] uppercase font-bold text-stone-500">
                      Newton's 2nd Law
                    </span>
                    <div className="text-base font-serif text-stone-900 py-1">
                      <MathView display math="\vec{F}_{\text{net}} = m \cdot \vec{a}" />
                    </div>
                  </div>
                  <div className="bg-white p-3.5 rounded-lg border border-blue-200/60 text-center space-y-1">
                    <span className="text-[10px] uppercase font-bold text-stone-500">
                      Static & Kinetic Friction Threshold
                    </span>
                    <div className="text-base font-serif text-stone-900 py-1">
                      <MathView display math="f_{s,\max} = \mu_s N, \quad f_k = \mu_k N" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Key Takeaways */}
            <div className="space-y-3">
              <h3 className="text-xs font-sans font-medium text-stone-400 uppercase tracking-wider">
                Essential Takeaways
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {lesson.keyTakeaways.map((takeaway, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-stone-50 border border-stone-200/70 flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#114B43] shrink-0 mt-0.5" />
                    <div className="text-xs text-stone-700 leading-relaxed">
                      <MathView text={takeaway} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Micro Example */}
            <div className="bg-[#1C1917] text-stone-200 rounded-xl p-5 sm:p-6 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-stone-400">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5" />
                  <span className="uppercase tracking-wider text-[11px]">Step-by-Step Example</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('example', lesson.microExample)}
                  className="inline-flex items-center gap-1 rounded-md border border-stone-700 px-2 py-1 text-[11px] text-stone-300 transition-colors hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-500"
                  aria-label="Copy step-by-step example"
                >
                  {copiedSection === 'example' ? <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
                  <span>{copiedSection === 'example' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="text-xs sm:text-sm text-stone-300 leading-relaxed font-mono whitespace-pre-wrap">
                <MathView text={lesson.microExample} />
              </div>
            </div>

            {/* Check Your Understanding Widget */}
            {lesson.checkYourUnderstanding && (
              <div className="border border-stone-200 rounded-xl bg-stone-50 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-stone-600" />
                  <h4 className="text-xs font-medium text-stone-700 uppercase tracking-wider">
                    Quick Concept Check
                  </h4>
                </div>
                <div className="text-sm font-medium text-stone-900">
                  <MathView text={lesson.checkYourUnderstanding.question} />
                </div>

                {showCheckAnswer ? (
                  <div className="p-4 bg-white rounded-lg border border-stone-200 space-y-1 animate-in fade-in">
                    <p className="text-xs font-medium text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Explanation:
                    </p>
                    <div className="text-xs text-stone-700 leading-relaxed">
                      <MathView text={lesson.checkYourUnderstanding.answer} />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      id="btn-reveal-concept-check"
                      type="button"
                      onClick={() => setShowCheckAnswer(true)}
                      className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-lg transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-1"
                    >
                      Reveal Explanation
                    </button>
                    <span className="text-xs text-stone-500 italic">
                      Hint: <MathView text={lesson.checkYourUnderstanding.hint} />
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Strategy note */}
            {lesson.strategyNote && (
              <p className="text-[11px] text-stone-400 italic text-right">
                {lesson.strategyNote}
              </p>
            )}

            {/* Bottom Next Action: Proceed to Assessment */}
            <div className="pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-4">
              <span className="text-xs text-stone-500">
                Ready to test your understanding with a quick practice check?
              </span>
              <button
                id="btn-proceed-assessment"
                type="button"
                onClick={() => onProceedToAssessment(concept.id)}
                disabled={loading || !lesson}
                className="py-2.5 px-5 bg-[#114B43] hover:bg-[#0D3F38] disabled:bg-stone-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-all flex items-center gap-2 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#114B43] focus:ring-offset-1"
              >
                <span>Proceed to Mastery Check</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : feedback?.type === 'error' ? (
          <div className="py-14 text-center text-sm text-stone-600">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-rose-500" aria-hidden="true" />
            <p className="font-medium text-stone-800">This lesson is unavailable right now.</p>
            <p className="mt-1 text-xs text-stone-500">Use Retry above to request it again.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
