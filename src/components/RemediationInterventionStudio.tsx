import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Sparkles,
  CheckCircle,
  FileText,
  Users,
  Send,
  Download,
  Printer,
  X,
  Layers,
  HelpCircle,
  ArrowRight,
  UserCheck,
  Loader2,
} from 'lucide-react';
import { ClassroomStudent } from '../types';
import { MathView } from './MathView';

interface WorksheetData {
  concept: string;
  problemStatementId: number;
  date: string;
  sectionA: {
    title: string;
    analogy: string;
  };
  sectionB: {
    title: string;
    problems: Array<{
      number: number;
      tag: string;
      prompt: string;
      answer?: string;
    }>;
  };
  answerKey: string;
}

interface RemediationInterventionStudioProps {
  students: ClassroomStudent[];
  bottlenecks: {
    concept: string;
    failureRate: number;
    recommendedAction: string;
  }[];
}

export const RemediationInterventionStudio: React.FC<RemediationInterventionStudioProps> = ({
  students,
  bottlenecks,
}) => {
  const [deployedAlerts, setDeployedAlerts] = useState<Record<string, boolean>>({});
  const [selectedBottleneckForWorksheet, setSelectedBottleneckForWorksheet] = useState<string | null>(null);
  const [worksheetData, setWorksheetData] = useState<WorksheetData | null>(null);
  const [isGeneratingWorksheet, setIsGeneratingWorksheet] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Group students who need intervention vs excelling for peer pairing
  const studentsNeedingHelp = students.filter(
    (s) => s.status === 'Needs Intervention' || s.overallMastery < 60
  );
  const excellingStudents = students.filter(
    (s) => s.status === 'Excelling' || s.overallMastery >= 80
  );

  // Fetch dynamic worksheet whenever a concept is selected
  useEffect(() => {
    if (!selectedBottleneckForWorksheet) {
      setWorksheetData(null);
      return;
    }

        setIsGeneratingWorksheet(true);
    fetch('/api/teacher/worksheet/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conceptTitle: selectedBottleneckForWorksheet,
        subject: 'Mathematics',
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('API Request Failed');
        return res.json();
      })
      .then((data) => {
        if (data.success && data.worksheet) {
          setWorksheetData(data.worksheet);
        } else {
          setWorksheetData(null);
        }
      })
      .catch((err) => {
        console.error('Failed to generate worksheet:', err);
        setToastMessage(`Failed to generate worksheet for "${selectedBottleneckForWorksheet}".` + (err ? ' (Please try again)' : ''));
        setTimeout(() => setToastMessage(null), 4000);
      })
      .finally(() => {
        setIsGeneratingWorksheet(false);
      });
  }, [selectedBottleneckForWorksheet]);

    const handleDeployScaffold = async (concept: string) => {
    try {
      const res = await fetch('/api/teacher/interventions/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptTitle: concept,
          subject: 'Mathematics',
        }),
      });
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();
      const count = data.impactedCount || 1;
      setToastMessage(`Practice exercises assigned to ${count} learner for: "${concept}".`);
      setDeployedAlerts((prev) => ({ ...prev, [concept]: true }));
    } catch (err) {
      console.error('Failed to deploy intervention:', err);
      setToastMessage(`Failed to assign practice for "${concept}".`);
      setDeployedAlerts((prev) => ({ ...prev, [concept]: false }));
    }
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handlePrintWorksheet = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
              Topic Review & Support
            </span>
            <span className="text-xs text-stone-400 font-sans">• Practice & Review Hub</span>
          </div>
          <h2 className="text-xl font-serif font-semibold text-stone-900 mt-1 tracking-tight flex items-center gap-2">
            <span>Classroom Help Topics & Study Plans</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1 max-w-2xl leading-relaxed">
            Spot topics where students are having difficulty before exams. Assign online practice sets or print classroom worksheets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-rose-50 border border-rose-200 px-3.5 py-2 rounded-xl text-right">
            <span className="text-[10px] uppercase font-bold text-rose-700 tracking-wider">At-Risk Count</span>
            <p className="text-lg font-serif font-bold text-rose-900">
              {studentsNeedingHelp.length} Students
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl text-right">
            <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Peer Mentors</span>
            <p className="text-lg font-serif font-bold text-emerald-900">
              {excellingStudents.length} Students
            </p>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between animate-in fade-in shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottlenecks Cards */}
      <div className="space-y-3">
        <h3 className="font-serif font-semibold text-stone-900 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>Identified Curriculum Bottlenecks ({bottlenecks.length})</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {bottlenecks.length === 0 && (
              <div className="col-span-1 md:col-span-3 p-8 text-center rounded-2xl border border-stone-200 border-dashed bg-stone-50/50">
                <h4 className="text-sm font-medium text-stone-900">No interventions needed</h4>
              </div>
            )}
            {bottlenecks.map((b) => {
            const isDeployed = deployedAlerts[b.concept];
            return (
              <div
                key={b.concept}
                className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                      {b.failureRate}% Failure Rate
                    </span>
                    <span className="text-[11px] text-stone-400">High Risk</span>
                  </div>

                  <h4 className="font-serif font-bold text-stone-900 text-sm">{b.concept}</h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    <span className="font-medium text-stone-900">Diagnosis:</span> {b.recommendedAction}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-100 flex flex-col gap-2">
                  <button
                    onClick={() => handleDeployScaffold(b.concept)}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isDeployed
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-[#114B43] hover:bg-[#0c3832] text-white shadow-2xs'
                    }`}
                  >
                    {isDeployed ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Practice Assigned</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Assign Practice Set</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setSelectedBottleneckForWorksheet(b.concept)}
                    className="w-full py-1.5 px-3 rounded-lg text-xs font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-stone-500" />
                    <span>Generate Remedial Worksheet</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Peer Tutoring Cohort Matcher */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-4">
          <div>
            <h3 className="font-serif font-semibold text-stone-900 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-[#114B43]" />
              <span>Suggested Peer Study Pairs</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Pairs students who have mastered a topic with classmates who could use a helping hand.
            </p>
          </div>
          <span className="text-[10px] font-mono text-stone-400 bg-stone-50 px-2 py-1 rounded border border-stone-200">
            Based on chapter mastery
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {studentsNeedingHelp.slice(0, 3).map((st, idx) => {
            const mentor = excellingStudents[idx % excellingStudents.length];
            return (
              <div
                key={st.id}
                className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-stone-400">Pair #{idx + 1}</span>
                  <span className="text-[10px] font-semibold text-stone-600 bg-white px-2 py-0.5 rounded border border-stone-200">
                    {st.strugglingConcept || 'Slope Intercept'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-rose-900 bg-rose-50/70 p-1.5 rounded border border-rose-200/60">
                    <span className="font-medium">{st.name}</span>
                    <span className="font-mono text-[11px] font-bold">{st.overallMastery}% Mastery</span>
                  </div>

                  <div className="flex justify-center my-0.5">
                    <ArrowRight className="w-3.5 h-3.5 text-stone-400 rotate-90 sm:rotate-0" />
                  </div>

                  {mentor && (
                    <div className="flex items-center justify-between text-emerald-900 bg-emerald-50/70 p-1.5 rounded border border-emerald-200/60">
                      <span className="font-medium">{mentor.name} (Peer Mentor)</span>
                      <span className="font-mono text-[11px] font-bold">{mentor.overallMastery}% Mastery</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: Printable Remedial Worksheet Studio */}
      {selectedBottleneckForWorksheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-stone-200 max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#114B43]" />
                <div>
                  <h3 className="font-serif font-semibold text-stone-900 text-sm">
                    Remedial Practice Worksheet
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Targeted for Concept: {selectedBottleneckForWorksheet}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBottleneckForWorksheet(null)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Content */}
            {isGeneratingWorksheet ? (
              <div className="border border-stone-200 rounded-xl p-12 bg-stone-50/50 flex flex-col items-center justify-center space-y-3 text-stone-500">
                <Loader2 className="w-6 h-6 animate-spin text-[#114B43]" />
                <p className="text-xs font-medium text-stone-600">
                  Preparing review worksheet...
                </p>
                <p className="text-[11px] text-stone-400">
                  Gathering practice exercises for {selectedBottleneckForWorksheet}
                </p>
              </div>
            ) : (
              <div className="border border-stone-200 rounded-xl p-6 bg-stone-50/50 space-y-4 text-xs font-sans">
                <div className="border-b border-stone-200 pb-3 flex justify-between items-start">
                  <div>
                    <h2 className="font-serif text-base font-bold text-stone-900">
                      LearnX Practice & Revision Worksheet • Problem Set #{worksheetData?.problemStatementId || 'PS-101'}
                    </h2>
                    <p className="text-stone-500 text-[11px]">
                      Curriculum Concept: {worksheetData?.concept || selectedBottleneckForWorksheet}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-stone-400 font-mono">
                    <p>Date: {worksheetData?.date || new Date().toLocaleDateString()}</p>
                    <p>Student Name: _________________</p>
                  </div>
                </div>

                {/* Section A: Intuitive Analogy Scaffold */}
                <div className="space-y-1.5 bg-white p-3.5 rounded-lg border border-stone-200">
                  <h4 className="font-serif font-bold text-stone-900 text-xs">
                    {worksheetData?.sectionA?.title || 'Section A: Concept Overview & Real-World Example'}
                  </h4>
                  <div className="text-stone-600 text-[11px] leading-relaxed">
                    <MathView
                      text={
                        worksheetData?.sectionA?.analogy ||
                        'Review this intuitive real-world example to solidify the core idea before solving the problems below.'
                      }
                    />
                  </div>
                </div>

                {/* Section B: Scaffolded Practice Exercises */}
                <div className="space-y-2">
                  <h4 className="font-serif font-bold text-stone-900 text-xs">
                    {worksheetData?.sectionB?.title || 'Section B: Guided Practice Problems'}
                  </h4>

                  <div className="space-y-2">
                    {(worksheetData?.sectionB?.problems || []).map((prob) => (
                      <div key={prob.number} className="bg-white p-3 rounded-lg border border-stone-200 space-y-1.5">
                        <p className="font-semibold text-stone-900">
                          Problem {prob.number} ({prob.tag}):
                        </p>
                        <div className="text-stone-700">
                          <MathView text={prob.prompt} />
                        </div>
                        <div className="h-10 border-b border-dashed border-stone-300"></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Teacher Answer Key Note */}
                {worksheetData?.answerKey && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900">
                    <MathView text={worksheetData.answerKey} />
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="pt-3 flex items-center justify-end gap-2 border-t border-stone-100">
              <button
                onClick={() => setSelectedBottleneckForWorksheet(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handlePrintWorksheet}
                className="px-4 py-2 bg-[#114B43] hover:bg-[#0c3832] text-white rounded-xl font-semibold shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save as PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
