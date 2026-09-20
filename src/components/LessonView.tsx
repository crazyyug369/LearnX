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

  const strategies: TeachingStrategy[] = [
    'Analogy & Real-world',
    'Socratic / Guided Inquiry',
    'Step-by-Step Visual',
    'First Principles',
  ];

  const fetchLesson = async () => {
    setLoading(true);
    setShowCheckAnswer(false);
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
      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();
      if (json.success && json.data) {
        setLesson(json.data);
      }
    } catch (err) {
      console.error('Failed to load lesson:', err);
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
    };
  }, [concept.id, interest, strategy]);

  const handleToggleSpeech = () => {
    if (!('speechSynthesis' in window)) return;
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
                key={strat}
                id={`btn-strategy-${strat.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                onClick={() => onChangeStrategy(strat)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
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
        {/* Header toolbar */}
        <div className="flex items-center justify-between pb-5 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-stone-500" />
            <span className="text-xs font-medium text-stone-600 uppercase tracking-wider">
              Micro-Lesson
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-lesson-tts-read"
              onClick={handleToggleSpeech}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
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
              onClick={fetchLesson}
              disabled={loading}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 transition-colors"
              title="Regenerate explanation"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-stone-900' : ''}`} />
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
              <div className="flex items-center gap-2 text-xs font-medium text-stone-400">
                <Terminal className="w-3.5 h-3.5" />
                <span className="uppercase tracking-wider text-[11px]">Step-by-Step Example</span>
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
                      onClick={() => setShowCheckAnswer(true)}
                      className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-lg transition-all shadow-2xs"
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
                onClick={() => onProceedToAssessment(concept.id)}
                className="py-2.5 px-5 bg-[#114B43] hover:bg-[#0D3F38] text-white rounded-lg text-xs font-medium transition-all flex items-center gap-2 shadow-2xs"
              >
                <span>Proceed to Mastery Check</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
