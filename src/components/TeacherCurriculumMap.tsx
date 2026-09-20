import React, { useState } from 'react';
import {
  Compass,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Clock,
  Tag,
  Search,
  BookOpen,
  Filter,
  Sparkles,
  GitFork,
  Network,
  Atom,
  Binary,
  Calculator,
  Plus,
  Trash2,
  Brain,
  X,
} from 'lucide-react';
import { ConceptNode } from '../types';

interface TeacherCurriculumMapProps {
  currentSubject: string;
  concepts: ConceptNode[];
  onSelectSubject?: (subj: string) => void;
  atRiskConcepts?: { concept: string; failureRate: number; recommendedAction: string }[];
  onAddConceptNode?: (newNode: ConceptNode) => void;
  onDeleteConceptNode?: (nodeId: string) => void;
}

export const TeacherCurriculumMap: React.FC<TeacherCurriculumMapProps> = ({
  currentSubject,
  concepts,
  onSelectSubject,
  atRiskConcepts = [],
  onAddConceptNode,
  onDeleteConceptNode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | 'Beginner' | 'Intermediate' | 'Advanced'>('All');
  const [selectedConcept, setSelectedConcept] = useState<ConceptNode | null>(concepts[0] || null);

  // Curriculum Studio Add Concept Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newGrade, setNewGrade] = useState('Grade 10');
  const [newCategory, setNewCategory] = useState('General');
  const [newDifficulty, setNewDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [newEstimatedTime, setNewEstimatedTime] = useState(25);
  const [newDescription, setNewDescription] = useState('');
  const [selectedPrereqs, setSelectedPrereqs] = useState<string[]>([]);
  const [aiRationale, setAiRationale] = useState('');
  const [isSuggestingAi, setIsSuggestingAi] = useState(false);
  const handleAiSuggestPrerequisites = async () => {
    if (!newTitle.trim()) return;
    setIsSuggestingAi(true);
    try {
            const res = await fetch('/api/curriculum/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          subject: currentSubject,
          grade: newGrade,
        }),
      });
      if (!res.ok) throw new Error('API request failed');
      const result = await res.json();
      if (result.success && result.data) {
        if (result.data.category) setNewCategory(result.data.category);
        if (result.data.difficulty) setNewDifficulty(result.data.difficulty);
        if (result.data.estimatedTimeMin) setNewEstimatedTime(result.data.estimatedTimeMin);
        if (result.data.description) setNewDescription(result.data.description);
        if (result.data.pedagogicalRationale) setAiRationale(result.data.pedagogicalRationale);
        if (Array.isArray(result.data.prerequisites) && result.data.prerequisites.length > 0) {
          const matchedIds = result.data.prerequisites.map((p: string) => {
            const match = concepts.find(
              (c) => c.title.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(c.title.toLowerCase())
            );
            return match ? match.id : p;
          });
          setSelectedPrereqs(matchedIds);
        }
      }
    } catch (err) {
      console.warn('Could not auto-suggest curriculum:', err);
    } finally {
      setIsSuggestingAi(false);
    }
  };

  const handleSaveNewConcept = async () => {
    if (!newTitle.trim()) return;
    const newId = `${currentSubject.toLowerCase().slice(0, 3)}-custom-${Date.now()}`;
    const newNode: ConceptNode = {
      id: newId,
      title: newTitle.trim(),
      subject: currentSubject,
      category: newCategory.trim() || 'General',
      description: newDescription.trim() || `Comprehensive study of ${newTitle} for ${newGrade}.`,
      difficulty: newDifficulty,
      estimatedTimeMin: newEstimatedTime,
      prerequisites: selectedPrereqs,
      masteryScore: 0,
      status: 'locked',
      tags: [currentSubject, newGrade, newDifficulty],
    };

    try {
      await fetch('/api/curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newNode.id,
          subject: newNode.subject,
          grade: newGrade,
          title: newNode.title,
          category: newNode.category,
          description: newNode.description,
          difficulty: newNode.difficulty,
          prerequisites: newNode.prerequisites,
          tags: newNode.tags,
          estimatedTime: newNode.estimatedTimeMin,
          createdBy: 'teacher',
        }),
      });
    } catch (e) {
      console.warn('Failed to save to backend:', e);
    }

    if (onAddConceptNode) {
      onAddConceptNode(newNode);
    }
    setSelectedConcept(newNode);
    setIsAddModalOpen(false);
    setNewTitle('');
    setNewDescription('');
    setAiRationale('');
    setSelectedPrereqs([]);
  };

      const handleDeleteConcept = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to remove this chapter from the curriculum map?')) {
        try {
          const res = await fetch(`/api/curriculum/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete concept');
          if (onDeleteConceptNode) {
            onDeleteConceptNode(id);
          }
        } catch (e) {
          console.error(e);
          alert('Failed to delete the concept.');
        }
      }
    };

  const filteredConcepts = concepts.filter((c) => {
    if (difficultyFilter !== 'All' && c.difficulty !== difficultyFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getSubjectIcon = (subj: string) => {
    switch (subj) {
      case 'Physics':
        return <Atom className="w-4 h-4" />;
      case 'Computer Science':
        return <Binary className="w-4 h-4" />;
      case 'Mathematics':
      default:
        return <Calculator className="w-4 h-4" />;
    }
  };

  const isAtRisk = (title: string) => {
    return atRiskConcepts.find(
      (a) => a.concept.toLowerCase().includes(title.toLowerCase()) || title.toLowerCase().includes(a.concept.toLowerCase())
    );
  };

  return (
    <div className="space-y-6 relative">

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-stone-400 mr-1" />
          {(['All', 'Beginner', 'Intermediate', 'Advanced'] as const).map((diff) => (
            <button
              key={diff}
              onClick={() => setDifficultyFilter(diff)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                difficultyFilter === diff
                  ? 'bg-stone-900 text-white shadow-2xs font-semibold'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts, tags, skills..."
              className="pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:outline-none focus:border-[#114B43] w-44 sm:w-56"
            />
          </div>

          <button
            id="btn-open-curriculum-studio"
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 bg-[#114B43] hover:bg-[#0D3F38] text-white rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Chapter Node</span>
          </button>
        </div>
      </div>

      {/* 2-Column Layout: Concept Cards Grid + Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Concepts Nodes List */}
        <div className="lg:col-span-7 space-y-3">
          {filteredConcepts.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500">
              <p className="font-serif text-sm">No curriculum concepts found.</p>
              <p className="text-xs mt-1 text-stone-400">Try adjusting difficulty or search filters.</p>
            </div>
          ) : (
            filteredConcepts.map((node, index) => {
              const risk = isAtRisk(node.title);
              const isSelected = selectedConcept?.id === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedConcept(node)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white border-[#114B43] shadow-md ring-1 ring-[#114B43]/20'
                      : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] font-bold text-stone-400 uppercase">
                          Node #{index + 1} • {node.id}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.2 rounded ${
                            node.difficulty === 'Beginner'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : node.difficulty === 'Intermediate'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                          }`}
                        >
                          {node.difficulty}
                        </span>
                        {risk && (
                          <span className="text-[10px] font-medium px-2 py-0.2 rounded bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                            <span>Bottleneck ({risk.failureRate}% Gap)</span>
                          </span>
                        )}
                      </div>
                      <h4 className="font-serif font-semibold text-stone-900 text-sm">{node.title}</h4>
                      <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                        {node.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0 text-stone-400 flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-stone-600">
                        <Clock className="w-3 h-3 text-stone-400" />
                        <span>{node.estimatedTimeMin} min</span>
                      </div>
                      <span className="text-[10px] text-stone-400">
                        {node.prerequisites.length} prerequisite{node.prerequisites.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Prerequisites Preview */}
                  {node.prerequisites.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center gap-1.5 flex-wrap text-[11px]">
                      <span className="text-stone-400 font-medium">Prerequisites:</span>
                      {node.prerequisites.map((prereqId) => {
                        const prereqNode = concepts.find((c) => c.id === prereqId);
                        return (
                          <span
                            key={prereqId}
                            className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded text-[10px] font-mono border border-stone-200"
                          >
                            {prereqNode ? prereqNode.title : prereqId}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Node Pedagogical Inspector */}
        <div className="lg:col-span-5">
          {selectedConcept ? (
            <div className="bg-white rounded-xl border border-stone-200/90 p-6 shadow-2xs space-y-5 sticky top-24">
              <div className="border-b border-stone-100 pb-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-stone-400 uppercase">
                    {selectedConcept.id}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                    {selectedConcept.category}
                  </span>
                </div>
                <h3 className="text-lg font-serif font-bold text-stone-900 tracking-tight">
                  {selectedConcept.title}
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {selectedConcept.description}
                </p>
              </div>

              {/* Instructional Specifications */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-stone-50 p-3 rounded-lg border border-stone-200">
                  <span className="text-[11px] text-stone-500 font-medium">Instructional Time</span>
                  <p className="font-serif font-bold text-stone-900 text-base mt-0.5">
                    {selectedConcept.estimatedTimeMin} Minutes
                  </p>
                </div>
                <div className="bg-stone-50 p-3 rounded-lg border border-stone-200">
                  <span className="text-[11px] text-stone-500 font-medium">Difficulty Level</span>
                  <p className="font-serif font-bold text-stone-900 text-base mt-0.5">
                    {selectedConcept.difficulty}
                  </p>
                </div>
              </div>

              {/* Prerequisite Chain Mapping */}
              <div className="space-y-2">
                <h4 className="text-xs font-serif font-semibold text-stone-900 flex items-center gap-1.5">
                  <GitFork className="w-3.5 h-3.5 text-stone-600" />
                  <span>Prerequisites & Connections</span>
                </h4>
                {selectedConcept.prerequisites.length === 0 ? (
                  <p className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                    Foundation Concept • No prior prerequisites required in this sequence.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedConcept.prerequisites.map((pId) => {
                      const found = concepts.find((c) => c.id === pId);
                      return (
                        <div
                          key={pId}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-stone-50 border border-stone-200 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#114B43]"></span>
                            <span className="font-medium text-stone-800">
                              {found ? found.title : pId}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-stone-400">{pId}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tags & Pedagogical Keywords */}
              <div className="space-y-2">
                <h4 className="text-xs font-serif font-semibold text-stone-900 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-stone-600" />
                  <span>Key Topics & Skills</span>
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedConcept.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 bg-stone-100 text-stone-700 rounded-lg text-[11px] font-medium border border-stone-200"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Educator Guidance Note */}
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-700 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-stone-900">
                  <BookOpen className="w-3.5 h-3.5 text-[#114B43]" />
                  <span>Recommended Teaching Approach</span>
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  For students demonstrating hesitation on this concept, recommend initiating review with concrete visual representations before proceeding to abstract formulaic derivations.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-400">
              <p className="font-serif text-sm text-stone-600">Select a concept on the left</p>
              <p className="text-xs mt-1">To view chapter prerequisites and learning objectives.</p>
            </div>
          )}
        </div>
      </div>

      {/* Curriculum Studio Add Concept Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-xl w-full p-6 space-y-5 relative my-8">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-100">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#114B43] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Curriculum Studio
                </span>
                <h3 className="text-lg font-serif font-semibold text-stone-900 mt-1">
                  Add Concept / Chapter to {currentSubject}
                </h3>
                <p className="text-xs text-stone-500">
                  Configure topic title, difficulty, and prerequisite connections.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Target Academic Grade</label>
                  <select
                    value={newGrade}
                    onChange={(e) => setNewGrade(e.target.value)}
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:border-[#114B43]"
                  >
                    {['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Grade 10', 'Grade 11', 'Grade 12'].map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Difficulty Level</label>
                  <select
                    value={newDifficulty}
                    onChange={(e) => setNewDifficulty(e.target.value as any)}
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:border-[#114B43]"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Chapter / Concept Title</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Work-Energy Theorem & Dissipative Forces"
                    className="flex-1 p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-[#114B43]"
                  />
                  <button
                    type="button"
                    onClick={handleAiSuggestPrerequisites}
                    disabled={isSuggestingAi || !newTitle.trim()}
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                    title="Query NCERT DAG (29,000 nodes) + Gemini for auto-suggestions"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isSuggestingAi ? 'animate-spin text-emerald-600' : 'text-emerald-700'}`} />
                    <span>{isSuggestingAi ? 'Analyzing...' : 'AI Auto-Suggest'}</span>
                  </button>
                </div>
              </div>

              {aiRationale && (
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg text-[11px] text-emerald-950 space-y-1">
                  <div className="font-semibold flex items-center gap-1 text-emerald-900">
                    <Brain className="w-3.5 h-3.5 text-emerald-700" />
                    <span>NCERT DAG Pedagogical Rationale:</span>
                  </div>
                  <p className="leading-relaxed">{aiRationale}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Curriculum Strand / Category</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="e.g. Mechanics, Algebra"
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-[#114B43]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Estimated Study Time (min)</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={newEstimatedTime}
                    onChange={(e) => setNewEstimatedTime(Number(e.target.value) || 20)}
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-[#114B43]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Prerequisite Dependency Nodes</label>
                <div className="max-h-32 overflow-y-auto p-2 bg-stone-50 border border-stone-200 rounded-lg space-y-1.5">
                  {concepts.length === 0 ? (
                    <p className="text-stone-400 text-[11px]">No existing concepts available as prerequisites.</p>
                  ) : (
                    concepts.map((c) => {
                      const isChecked = selectedPrereqs.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 text-stone-800 text-[11px] cursor-pointer hover:bg-stone-100 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPrereqs([...selectedPrereqs, c.id]);
                              } else {
                                setSelectedPrereqs(selectedPrereqs.filter((id) => id !== c.id));
                              }
                            }}
                            className="rounded text-[#114B43] focus:ring-0"
                          />
                          <span className="font-medium">{c.title}</span>
                          <span className="text-stone-400 font-mono text-[10px]">({c.category})</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Pedagogical Overview & Objectives</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Outline key learning outcomes and foundational principles..."
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-[#114B43]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewConcept}
                disabled={!newTitle.trim()}
                className="px-5 py-2 bg-[#114B43] hover:bg-[#0D3F38] text-white rounded-lg text-xs font-semibold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
              >
                Save Node to Curriculum
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

