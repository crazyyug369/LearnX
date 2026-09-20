import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ArrowRight, Zap, Sparkles, Youtube, ExternalLink, ShieldAlert, Award, Clock } from 'lucide-react';
import { getDiagnosticQuestionsForGrade, DiagnosticQuestion } from '../data/gradeCurriculum';
import { getYouTubeReferenceForQuestion } from '../utils/youtubeReference';
import { MathView } from './MathView';

interface DiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleteDiagnostic: (results: { conceptId: string; score: number }[], newConceptsMap?: any) => void;
  isMandatory?: boolean;
  grade?: string;
  subject?: string;
  userId?: string;
}

export const DiagnosticModal: React.FC<DiagnosticModalProps> = ({
  isOpen,
  onClose,
  onCompleteDiagnostic,
  isMandatory = false,
  grade = 'Class 10',
  subject = 'Mathematics',
  userId,
}) => {
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<(number | null)[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [serverCalibratedMap, setServerCalibratedMap] = useState<any>(null);

  // Initialize grade-specific questions whenever modal opens or grade changes
  useEffect(() => {
    if (isOpen) {
      const qList = getDiagnosticQuestionsForGrade(grade, subject);
      setQuestions(qList);
      setCurrentIdx(0);
      setSelectedOptions(new Array(qList.length).fill(null));
      setIsCompleted(false);
      setServerCalibratedMap(null);
    }
  }, [isOpen, grade, subject]);

  if (!isOpen || questions.length === 0) return null;

  const currentQ = questions[currentIdx];

  const handleSelectOption = (optIdx: number) => {
    const updated = [...selectedOptions];
    updated[currentIdx] = optIdx;
    setSelectedOptions(updated);
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handleApplyCalibration = async () => {
    setIsCalibrating(true);
    const answersPayload = questions.map((q, idx) => {
      const isCorrect = selectedOptions[idx] === q.correctIndex;
      return {
        questionId: q.id,
        conceptId: q.conceptId,
        isCorrect,
        difficulty: q.difficulty,
        bloomsLevel: q.bloomsLevel,
        timeSpent: 25,
      };
    });

    const localResults = questions.map((q, idx) => {
      const isCorrect = selectedOptions[idx] === q.correctIndex;
      const diff = (q.difficulty || '').toLowerCase();
      let score = 40;
      if (isCorrect) {
        score = diff.includes('adv') ? 95 : diff.includes('inter') ? 88 : 82;
      } else {
        score = diff.includes('adv') ? 48 : diff.includes('inter') ? 40 : 32;
      }
      return {
        conceptId: q.conceptId,
        score,
      };
    });

    // Send async calibration to MySQL if userId is available
    if (userId) {
      try {
        const res = await fetch('/api/diagnostic/calibrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            grade,
            subject,
            answers: answersPayload,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.conceptsMap) {
            setServerCalibratedMap(data.conceptsMap);
            onCompleteDiagnostic(data.results || localResults, data.conceptsMap);
            onClose();
            setIsCalibrating(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Background diagnostic calibration sync:', err);
      }
    }

    onCompleteDiagnostic(localResults, serverCalibratedMap);
    setIsCalibrating(false);
    onClose();
  };

  const getDifficultyBadge = (diff: string, blooms: string) => {
    const d = (diff || '').toLowerCase();
    if (d.includes('adv') || d.includes('hard')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
          <span>Hard</span>
          <span>•</span>
          <span>{blooms || 'Analysis'}</span>
        </span>
      );
    }
    if (d.includes('inter') || d.includes('medium')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
          <span>Medium</span>
          <span>•</span>
          <span>{blooms || 'Application'}</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
        <span>Easy</span>
        <span>•</span>
        <span>{blooms || 'Recall'}</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in duration-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#114B43]">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-sm sm:text-base text-stone-900">
                  {isMandatory ? 'Initial Diagnostic Assessment' : 'Diagnostic Knowledge Check'}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-200 text-stone-700">
                  {grade}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                {isMandatory
                  ? 'Setting up your course starting point based on prerequisite knowledge'
                  : 'Test your understanding of prerequisite topics to unlock upcoming lessons'}
              </p>
            </div>
          </div>

          {!isMandatory && (
            <button
              id="btn-close-diagnostic-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Mandatory Banner */}
        {isMandatory && (
          <div className="px-6 py-2 bg-amber-50/80 border-b border-amber-200/60 flex items-center gap-2 text-xs text-amber-900">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>
              <strong>Quick Starting Quiz:</strong> Answer these questions to set up your personalized learning path.
            </span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6">
          {!isCompleted ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between text-xs text-stone-500 font-sans">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-stone-700 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                    Question {currentIdx + 1} of {questions.length}
                  </span>
                  {getDifficultyBadge(currentQ.difficulty, currentQ.bloomsLevel)}
                </div>
                <span className="text-[11px] text-stone-400 font-medium">
                  {currentQ.conceptTitle}
                </span>
              </div>

              {/* Question Text */}
              <div className="p-4 bg-stone-50 border border-stone-200/80 rounded-xl">
                <h4 className="text-sm sm:text-base font-display font-medium text-stone-900 leading-relaxed">
                  <MathView text={currentQ.text} />
                </h4>
              </div>

              {/* Options */}
              <div className="space-y-2.5">
                {currentQ.options.map((opt, idx) => {
                  const isSelected = selectedOptions[currentIdx] === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      className={`p-3.5 rounded-xl border text-xs sm:text-sm cursor-pointer transition-all flex items-center gap-3 ${
                        isSelected
                          ? 'border-[#114B43] bg-emerald-50/40 text-stone-950 font-medium ring-1 ring-[#114B43]/20'
                          : 'border-stone-200 hover:border-stone-300 bg-white text-stone-800'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-[#114B43] text-white'
                            : 'bg-stone-100 text-stone-500 group-hover:bg-stone-200'
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <span className="leading-snug">
                        <MathView text={opt} />
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-stone-400">
                  {selectedOptions[currentIdx] === null ? 'Select an answer to proceed' : 'Ready'}
                </span>
                <button
                  id="btn-next-diagnostic-q"
                  onClick={handleNext}
                  disabled={selectedOptions[currentIdx] === null}
                  className="py-2.5 px-5 bg-[#114B43] hover:bg-[#0D3F38] disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shadow-2xs cursor-pointer"
                >
                  <span>
                    {currentIdx < questions.length - 1 ? 'Next Question' : 'Submit & Calibrate Graph'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Calibration Results View */
            <div className="text-center py-2 space-y-5">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-200 shadow-2xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-display font-semibold text-stone-900">
                  Course Setup Complete!
                </h4>
                <p className="text-xs text-stone-600 mt-1 max-w-sm mx-auto leading-relaxed">
                  Your diagnostic test responses have been evaluated across {grade} chapters, setting up your personalized starting lessons.
                </p>
              </div>

              {/* Adjustments Breakdown */}
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-xs text-left space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-stone-700 uppercase tracking-wider">
                  <span>Diagnostic Assessment:</span>
                  <span className="text-emerald-700 font-mono">Chapter Mastery</span>
                </div>
                {questions.map((q, idx) => {
                  const isCorrect = selectedOptions[idx] === q.correctIndex;
                  const diff = (q.difficulty || '').toLowerCase();
                  const masteryEstimate = isCorrect ? (diff.includes('adv') ? 95 : diff.includes('inter') ? 88 : 82) : (diff.includes('adv') ? 48 : 35);
                  const yt = getYouTubeReferenceForQuestion(q, selectedOptions[idx] !== null ? q.options[selectedOptions[idx]!] : undefined);
                  return (
                    <div key={q.id} className="flex flex-wrap items-center justify-between text-xs py-2 border-b border-stone-200/60 last:border-b-0 gap-2">
                      <div>
                        <span className="text-stone-900 font-medium">{q.conceptTitle}</span>
                        <div className="text-[10px] text-stone-400">{q.bloomsLevel} • {q.difficulty}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${isCorrect ? 'text-emerald-800 bg-emerald-50 border border-emerald-200' : 'text-rose-800 bg-rose-50 border border-rose-200'} px-2 py-0.5 rounded text-[11px]`}>
                          {isCorrect ? `Mastered (${masteryEstimate}%)` : `Review Needed (${masteryEstimate}%)`}
                        </span>
                        {!isCorrect && (
                          <a
                            href={yt.directUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-800 bg-white border border-red-200 px-2 py-0.5 rounded transition-colors"
                            title={`Watch video explanation: ${yt.videoTitle}`}
                          >
                            <Youtube className="w-3 h-3 fill-current" />
                            <span>Review Video</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                id="btn-apply-diagnostic"
                onClick={handleApplyCalibration}
                disabled={isCalibrating}
                className="w-full py-3 bg-[#114B43] hover:bg-[#0D3F38] disabled:bg-stone-300 text-white rounded-xl text-xs font-semibold transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isCalibrating ? 'Synchronizing with Database...' : 'Apply Calibration & Enter Learning Path'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
