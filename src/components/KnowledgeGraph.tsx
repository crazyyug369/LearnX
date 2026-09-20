import React, { useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  Lock,
  ArrowRight,
  TrendingUp,
  Layers,
  Sparkles,
  Zap,
  PlayCircle,
  RotateCcw,
  Network,
  ListOrdered,
  Clock,
  Compass,
  ArrowUpRight,
  User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ConceptNode, UserProfile, UserRole } from '../types';

interface KnowledgeGraphProps {
  concepts: ConceptNode[];
  selectedConceptId: string;
  onSelectConcept: (conceptId: string) => void;
  onStartLesson: (conceptId: string) => void;
  onStartAssessment: (conceptId: string) => void;
  onOpenDiagnostic: () => void;
  overallMastery: number;
  onViewAnalytics?: () => void;
  currentUser?: UserProfile | null;
  onOpenAuth?: (role?: UserRole) => void;
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  concepts,
  selectedConceptId,
  onSelectConcept,
  onStartLesson,
  onStartAssessment,
  onOpenDiagnostic,
  overallMastery,
  onViewAnalytics,
  currentUser,
  onOpenAuth,
}) => {
  const [viewMode, setViewMode] = useState<'network' | 'timeline'>('network');
  const [hoveredConceptId, setHoveredConceptId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isLoggedIn = Boolean(currentUser);

  const selectedConcept = concepts.find((c) => c.id === selectedConceptId) || concepts[0];

  const masteredCount = concepts.filter((c) => c.status === 'mastered').length;
  const inProgressCount = concepts.filter((c) => c.status === 'in_progress').length;
  const gapCount = concepts.filter((c) => c.status === 'prerequisite_gap' || c.status === 'remediation').length;

  // Calculate topological coordinates for the SVG Network Graph
  const canvasWidth = isMobile ? 340 : 860;
  const paddingX = isMobile ? 75 : 90;
  const paddingY = isMobile ? 60 : 90;

  // Mobile layout relies heavily on vertical flow, Desktop relies on horizontal
  const stepY = isMobile ? 120 : 0;
  const canvasHeight = isMobile ? Math.max(360, concepts.length * stepY + paddingY * 2) : 360;
  const stepX = isMobile
    ? 0
    : (canvasWidth - paddingX * 2) / Math.max(1, concepts.length - 1);

  const nodePositions = concepts.map((c, index) => {
    if (isMobile) {
      // Zigzag vertically on mobile
      const x = index % 2 === 0 ? paddingX : canvasWidth - paddingX;
      // Stagger downward sequentially
      const y = paddingY + index * stepY;
      return { concept: c, x, y, index };
    } else {
      const x = paddingX + index * stepX;
      // Stagger y for natural constellation topology horizontally
      const y = index % 2 === 0 ? 115 : 245;
      return { concept: c, x, y, index };
    }
  });

  const getStatusBadge = (status: ConceptNode['status'], score: number) => {
    if (!isLoggedIn) {
      if (status === 'locked') {
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-500 px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700">
            <Lock className="w-3 h-3 text-stone-400" /> Prerequisite Required
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800/60">
          <CheckCircle className="w-3 h-3 text-teal-600 dark:text-teal-400" /> Open Topic
        </span>
      );
    }

    switch (status) {
      case 'mastered':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> Mastered ({score}%)
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-teal-50 text-teal-800 px-2 py-0.5 rounded-md border border-teal-200">
            <Zap className="w-3 h-3 text-teal-600" /> In Progress ({score}%)
          </span>
        );
      case 'remediation':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> Needs Review ({score}%)
          </span>
        );
      case 'prerequisite_gap':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-rose-50 text-rose-800 px-2 py-0.5 rounded-md border border-rose-200">
            <RotateCcw className="w-3 h-3 text-rose-600" /> Gap Alert ({score}%)
          </span>
        );
      case 'locked':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-stone-100 text-stone-500 px-2 py-0.5 rounded-md border border-stone-200">
            <Lock className="w-3 h-3 text-stone-400" /> Locked
          </span>
        );
    }
  };

  // Radial progress circle math
  const gaugeRadius = 26;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeOffset = gaugeCircumference - (overallMastery / 100) * gaugeCircumference;

  return (
    <div className="space-y-6">
      {/* Bespoke Atelier Mastery Ribbon (Replaces Generic 4-Card Metric Grid) */}
      <div className="bg-white dark:bg-[#1C1C1A] rounded-2xl border border-stone-200/90 dark:border-stone-800 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          {/* Left: Radial Mastery Dial & Summary */}
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg className="w-16 h-16 -rotate-90 transform" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r={gaugeRadius}
                  className="text-stone-100 dark:text-stone-800 stroke-current"
                  strokeWidth="5"
                  fill="transparent"
                />
                {isLoggedIn && (
                  <circle
                    cx="32"
                    cy="32"
                    r={gaugeRadius}
                    className="text-[#114B43] dark:text-[#34D399] stroke-current transition-all duration-1000 ease-out"
                    strokeWidth="5"
                    strokeDasharray={gaugeCircumference}
                    strokeDashoffset={gaugeOffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                {isLoggedIn ? (
                  <>
                    <span className="font-serif font-bold text-sm text-stone-900 dark:text-stone-100 leading-none">
                      {overallMastery}%
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-stone-400 dark:text-stone-500 mt-0.5 font-medium">
                      Mastery
                    </span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-stone-400 dark:text-stone-500 mb-0.5" />
                    <span className="text-[8px] uppercase tracking-wider text-stone-400 dark:text-stone-500 font-semibold leading-none">
                      Guest
                    </span>
                  </>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-semibold text-base text-stone-900 dark:text-stone-100">
                  {concepts[0]?.subject || 'Curriculum'} Knowledge Graph
                </span>
                {isLoggedIn ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                    {masteredCount}/{concepts.length} Mastered
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 flex items-center gap-1">
                    <Compass className="w-3 h-3 text-stone-400" />
                    <span>Curriculum Catalog</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 max-w-md">
                {isLoggedIn
                  ? 'Track your chapter mastery and complete prerequisite topics to unlock upcoming lessons.'
                  : 'Browse the course curriculum and topic connections. Sign in to track your progress and unlock lessons.'}
              </p>
            </div>
          </div>

          {/* Center / Right: Focal Vector & Actions */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end pt-3 lg:pt-0 border-t lg:border-t-0 border-stone-100 dark:border-stone-800">
            {/* View Mode Toggle: Network vs Timeline */}
            <div className="flex items-center bg-stone-100 dark:bg-stone-900/90 p-1 rounded-xl border border-stone-200/80 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-300">
              <button
                id="btn-view-network"
                onClick={() => setViewMode('network')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  viewMode === 'network'
                    ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-2xs font-semibold'
                    : 'hover:text-stone-900 dark:hover:text-stone-100 text-stone-500 dark:text-stone-400'
                }`}
                title="View interactive directed acyclic graph"
              >
                <Network className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Concept Network</span>
                <span className="sm:hidden">Graph</span>
              </button>
              <button
                id="btn-view-timeline"
                onClick={() => setViewMode('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  viewMode === 'timeline'
                    ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-2xs font-semibold'
                    : 'hover:text-stone-900 dark:hover:text-stone-100 text-stone-500 dark:text-stone-400'
                }`}
                title="View structured syllabus roadmap"
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Syllabus Roadmap</span>
                <span className="sm:hidden">Roadmap</span>
              </button>
            </div>

            {/* Growth Analytics Charts Button */}
            {onViewAnalytics && (
              <button
                id="btn-open-growth-charts"
                onClick={onViewAnalytics}
                className="px-3 py-1.5 bg-[#114B43]/10 hover:bg-[#114B43]/15 text-[#114B43] dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 border border-[#114B43]/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-98"
                title="Open detailed graphical progress charts"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Growth Charts</span>
              </button>
            )}

            {/* Baseline Diagnostic Calibrate Button */}
            <button
              id="btn-run-diagnostic"
              onClick={() => {
                if (!isLoggedIn && onOpenAuth) {
                  onOpenAuth('student');
                } else {
                  onOpenDiagnostic();
                }
              }}
              className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 dark:bg-stone-800 dark:hover:bg-stone-700 text-white rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 border border-transparent dark:border-stone-700 shadow-2xs cursor-pointer active:scale-98"
              title="Test your starting level with a quick 2-minute readiness quiz"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 dark:text-amber-300" />
              <span>Readiness Check</span>
            </button>
          </div>
        </div>

        {/* Guest Mode Callout Banner */}
        {!isLoggedIn && (
          <div className="mt-4 p-3.5 bg-gradient-to-r from-[#114B43]/5 via-amber-500/5 to-transparent rounded-xl border border-[#114B43]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-2.5 text-stone-700 dark:text-stone-300">
              <div className="w-7 h-7 rounded-lg bg-[#114B43]/10 dark:bg-emerald-950/50 flex items-center justify-center text-[#114B43] dark:text-emerald-400 shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-stone-900 dark:text-stone-100">Guest Mode: </span>
                <span>You are exploring unauthenticated. Sign in or register as a student to track concept mastery in real time, record diagnostic calibration, and unlock personalized AI lessons.</span>
              </div>
            </div>
            {onOpenAuth && (
              <button
                id="btn-guest-banner-signin"
                onClick={() => onOpenAuth('student')}
                className="self-start sm:self-auto px-3.5 py-1.5 rounded-lg bg-[#114B43] hover:bg-[#0D3F38] text-white text-xs font-semibold shadow-2xs transition-all whitespace-nowrap cursor-pointer shrink-0"
              >
                Sign In as Student
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Interactive Stage & Side Deep-Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Dynamic Graph Canvas OR Structured Roadmap */}
        <div className="lg:col-span-8 bg-white dark:bg-[#1C1C1A] rounded-2xl border border-stone-200/90 dark:border-stone-800 shadow-xs overflow-hidden">
          {/* Header Strip */}
          <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 bg-[#FAF8F5]/60 dark:bg-stone-900/60">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#114B43] dark:text-[#34D399]" />
              <h2 className="font-serif font-semibold text-stone-900 dark:text-stone-100 text-sm sm:text-base">
                {viewMode === 'network' ? 'Interactive Topological Graph' : 'Curriculum Mastery Roadmap'}
              </h2>
              <span className="text-xs text-stone-400 dark:text-stone-500 font-sans hidden sm:inline">• Click node to inspect</span>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] font-medium text-stone-600 dark:text-stone-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-600" /> Mastered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#114B43] dark:bg-emerald-600 border border-[#0D3F38] dark:border-emerald-500" /> Focus
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-600" /> Gap
              </span>
              <span className="flex items-center gap-1.5 text-stone-400 dark:text-stone-500">
                <span className="w-2.5 h-2.5 rounded-full bg-stone-300 dark:bg-stone-700 border border-stone-400 dark:border-stone-600" /> Locked
              </span>
            </div>
          </div>

          {/* VIEW MODE 1: Interactive SVG Visual Network Graph */}
          {viewMode === 'network' && (
            <div className="p-4 sm:p-6 overflow-x-auto">
              <div className={isMobile ? "w-full relative" : "min-w-[700px] relative"}>
                <svg
                  viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                  className="w-full h-auto select-none"
                  style={{ minHeight: isMobile ? `${Math.max(340, canvasHeight)}px` : '340px' }}
                >
                  <defs>
                    {/* Subtle blueprint background dot grid */}
                    <pattern id="graph-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="2" cy="2" r="1" fill="#E7E5E0" />
                    </pattern>

                    {/* Gradient for mastered edges */}
                    <linearGradient id="edge-gradient-mastered" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#114B43" />
                    </linearGradient>

                    {/* Arrow markers */}
                    <marker
                      id="arrow-mastered"
                      viewBox="0 0 10 10"
                      refX="22"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#114B43" />
                    </marker>

                    <marker
                      id="arrow-locked"
                      viewBox="0 0 10 10"
                      refX="22"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#D6D3D1" />
                    </marker>
                  </defs>

                  {/* Dot Grid Background */}
                  <rect width={canvasWidth} height={canvasHeight} fill="url(#graph-dots)" />

                  {/* Dependency Bezier Connections (Edges) */}
                  {nodePositions.map((target) => {
                    return target.concept.prerequisites.map((prereqId) => {
                      const source = nodePositions.find((n) => n.concept.id === prereqId);
                      if (!source) return null;

                      const isPrereqMastered = source.concept.masteryScore >= 80;
                      const isTargetActive = target.concept.id === selectedConceptId;
                      const isHovered =
                        hoveredConceptId === source.concept.id || hoveredConceptId === target.concept.id;

                      const dx = (target.x - source.x) * (isMobile ? 0 : 0.5);
                      const dy = (target.y - source.y) * (isMobile ? 0.5 : 0);
                      const pathData = isMobile
                        ? `M ${source.x} ${source.y} C ${source.x} ${source.y + dy}, ${target.x} ${target.y - dy}, ${target.x} ${target.y}`
                        : `M ${source.x} ${source.y} C ${source.x + dx} ${source.y}, ${
                            target.x - dx
                          } ${target.y}, ${target.x} ${target.y}`;

                      return (
                        <g key={`${source.concept.id}->${target.concept.id}`}>
                          {/* Background shadow stroke for edge contrast */}
                          <path
                            d={pathData}
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth={isHovered ? '6' : '4'}
                            strokeLinecap="round"
                          />
                          {/* Main connection curve */}
                          <path
                            d={pathData}
                            fill="none"
                            stroke={
                              isPrereqMastered
                                ? '#114B43'
                                : target.concept.status === 'prerequisite_gap'
                                ? '#E11D48'
                                : '#D6D3D1'
                            }
                            strokeWidth={isHovered ? '2.5' : isTargetActive ? '2' : '1.5'}
                            strokeDasharray={!isPrereqMastered ? '5,4' : undefined}
                            className={isPrereqMastered && isTargetActive ? 'graph-edge-active' : ''}
                            markerEnd={isPrereqMastered ? 'url(#arrow-mastered)' : 'url(#arrow-locked)'}
                            opacity={isHovered ? 1 : 0.85}
                          />
                        </g>
                      );
                    });
                  })}

                  {/* Interactive Nodes */}
                  {nodePositions.map(({ concept, x, y, index }) => {
                    const isSelected = concept.id === selectedConceptId;
                    const isHovered = hoveredConceptId === concept.id;
                    const nodeRadius = 26;
                    const circumference = 2 * Math.PI * (nodeRadius + 4);
                    const strokeOffset = isLoggedIn
                      ? circumference - (concept.masteryScore / 100) * circumference
                      : circumference;

                    return (
                      <g
                        key={concept.id}
                        id={`svg-node-${concept.id}`}
                        onClick={() => onSelectConcept(concept.id)}
                        onMouseEnter={() => setHoveredConceptId(concept.id)}
                        onMouseLeave={() => setHoveredConceptId(null)}
                        className="cursor-pointer transition-transform duration-200 ease-out"
                        style={{ transformOrigin: `${x}px ${y}px` }}
                      >
                        {/* Outer Glow Halo for Selected Active Node */}
                        {isSelected && (
                          <circle
                            cx={x}
                            cy={y}
                            r={nodeRadius + 10}
                            fill="none"
                            stroke="#114B43"
                            strokeWidth="1.5"
                            strokeDasharray="4 3"
                            opacity="0.5"
                            className="animate-spin"
                            style={{ animationDuration: '14s' }}
                          />
                        )}

                        {/* Mastery Progress Ring */}
                        <circle
                          cx={x}
                          cy={y}
                          r={nodeRadius + 4}
                          fill="none"
                          stroke="#E7E5E0"
                          strokeWidth="3"
                        />
                        <circle
                          cx={x}
                          cy={y}
                          r={nodeRadius + 4}
                          fill="none"
                          stroke={
                            concept.status === 'mastered'
                              ? '#10B981'
                              : concept.status === 'prerequisite_gap'
                              ? '#E11D48'
                              : concept.status === 'remediation'
                              ? '#D97706'
                              : '#114B43'
                          }
                          strokeWidth="3.5"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeOffset}
                          strokeLinecap="round"
                          className="transition-all duration-700 ease-out"
                          transform={`rotate(-90 ${x} ${y})`}
                        />

                        {/* Main Node Disc */}
                        <circle
                          cx={x}
                          cy={y}
                          r={nodeRadius}
                          fill={
                            isSelected
                              ? '#114B43'
                              : concept.status === 'mastered'
                              ? '#ECFDF5'
                              : concept.status === 'prerequisite_gap'
                              ? '#FFF1F2'
                              : '#FFFFFF'
                          }
                          stroke={isSelected ? '#0D3F38' : '#D6D3D1'}
                          strokeWidth={isSelected ? '2' : '1'}
                          className="transition-colors duration-200"
                        />

                        {/* Node Center Label / Index / Icon */}
                        <text
                          x={x}
                          y={y + 5}
                          textAnchor="middle"
                          fontSize="13"
                          fontFamily="Newsreader, serif"
                          fontWeight="600"
                          fill={
                            isSelected
                              ? '#FFFFFF'
                              : concept.status === 'mastered'
                              ? '#065F46'
                              : concept.status === 'prerequisite_gap'
                              ? '#9F1239'
                              : '#292524'
                          }
                        >
                          {concept.status === 'mastered' ? '✓' : concept.status === 'locked' ? '🔒' : index + 1}
                        </text>

                        {/* Text Label Pill Below / Above */}
                        <g transform={`translate(${x}, ${isMobile || y > 180 ? y + 42 : y - 42})`}>
                          <rect
                            x="-70"
                            y="-14"
                            width="140"
                            height="24"
                            rx="12"
                            fill={isSelected ? '#1C1917' : '#FFFFFF'}
                            stroke={isSelected ? '#1C1917' : '#E7E5E0'}
                            strokeWidth="1"
                            filter="drop-shadow(0 1px 2px rgba(0,0,0,0.06))"
                          />
                          <text
                            x="0"
                            y="2"
                            textAnchor="middle"
                            fontSize="11"
                            fontFamily="Outfit, sans-serif"
                            fontWeight={isSelected ? '600' : '500'}
                            fill={isSelected ? '#FFFFFF' : '#292524'}
                          >
                            {concept.title.length > 17 ? `${concept.title.slice(0, 16)}…` : concept.title}
                          </text>
                        </g>

                        {/* Mastery Score / Difficulty Tag */}
                        <g transform={`translate(${x}, ${isMobile || y > 180 ? y + 66 : y - 66})`}>
                          <text
                            x="0"
                            y="2"
                            textAnchor="middle"
                            fontSize="10"
                            fontFamily={isLoggedIn ? 'monospace' : 'Outfit, sans-serif'}
                            fontWeight="500"
                            fill={isLoggedIn && concept.masteryScore >= 80 ? '#047857' : '#78716C'}
                          >
                            {isLoggedIn ? `${concept.masteryScore}% mastery` : concept.difficulty}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: Structured Curriculum Roadmap */}
          {viewMode === 'timeline' && (
            <div className="p-4 sm:p-6 space-y-3">
              {concepts.map((concept, index) => {
                const isSelected = concept.id === selectedConceptId;
                const prereqNames = concept.prerequisites
                  .map((pid) => concepts.find((c) => c.id === pid)?.title)
                  .filter(Boolean)
                  .join(', ');

                return (
                  <motion.div
                    key={concept.id}
                    id={`roadmap-item-${concept.id}`}
                    onClick={() => onSelectConcept(concept.id)}
                    whileHover={{ scale: 1.006 }}
                    transition={{ duration: 0.15 }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isSelected
                        ? 'border-stone-900 dark:border-stone-500 bg-stone-50/90 dark:bg-stone-800/80 shadow-2xs'
                        : 'border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1C1C1A] hover:border-stone-300 dark:hover:border-stone-700 hover:bg-stone-50/40 dark:hover:bg-stone-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-serif font-medium text-xs shrink-0 mt-0.5 ${
                          concept.status === 'mastered'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : concept.status === 'in_progress'
                            ? 'bg-[#114B43] dark:bg-emerald-700 text-white'
                            : concept.status === 'remediation'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300'
                            : concept.status === 'prerequisite_gap'
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500'
                        }`}
                      >
                        {concept.status === 'mastered' ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : concept.status === 'locked' ? (
                          <Lock className="w-4 h-4" />
                        ) : (
                          index + 1
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-serif font-semibold text-sm text-stone-900 dark:text-stone-100">
                            {concept.title}
                          </h4>
                          {getStatusBadge(concept.status, concept.masteryScore)}
                        </div>

                        <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-1">
                          {concept.description}
                        </p>

                        {concept.prerequisites.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400 pt-0.5">
                            <span className="text-stone-400 dark:text-stone-500 font-medium">Prerequisites:</span>
                            <span className="text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded text-[10px] border border-stone-200 dark:border-stone-700">
                              {prereqNames}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-stone-800">
                      {isLoggedIn ? (
                        <div className="text-right">
                          <span className="text-xs font-serif font-semibold text-stone-900 dark:text-stone-100">
                            {concept.masteryScore}%
                          </span>
                          <div className="w-16 bg-stone-100 dark:bg-stone-800 h-1.5 rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                concept.masteryScore >= 80
                                  ? 'bg-emerald-600'
                                  : concept.masteryScore >= 60
                                  ? 'bg-[#114B43]'
                                  : 'bg-amber-600'
                              }`}
                              style={{ width: `${concept.masteryScore}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="text-xs font-medium text-stone-400 dark:text-stone-500">
                            {concept.difficulty}
                          </span>
                        </div>
                      )}

                      <button
                        id={`btn-select-node-${concept.id}`}
                        className={`p-2 rounded-lg text-xs font-medium flex items-center transition-all ${
                          isSelected
                            ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                        }`}
                        title="Focus on concept"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 4 Columns: Deep-Dive Concept Inspector */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#1C1C1A] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-5 sm:p-6 shadow-xs sticky top-24 space-y-5">
            {/* Header / Category Pill */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <span className="text-[11px] font-sans font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                Concept Inspector
              </span>
              <span className="text-[11px] px-2.5 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-medium rounded-full">
                {selectedConcept.category}
              </span>
            </div>

            {/* Concept Title & Description */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-serif font-semibold text-stone-900 dark:text-stone-100 tracking-tight">
                  {selectedConcept.title}
                </h3>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-2 leading-relaxed">
                {selectedConcept.description}
              </p>
            </div>

            {/* Metrics: Difficulty & Est. Time */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 bg-stone-50 dark:bg-stone-900/60 rounded-xl border border-stone-200/70 dark:border-stone-800">
                <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase font-medium block">Difficulty</span>
                <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 mt-0.5 block">
                  {selectedConcept.difficulty}
                </span>
              </div>
              <div className="p-2.5 bg-stone-50 dark:bg-stone-900/60 rounded-xl border border-stone-200/70 dark:border-stone-800">
                <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase font-medium block">Time Investment</span>
                <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 mt-0.5 block flex items-center gap-1">
                  <Clock className="w-3 h-3 text-stone-500 dark:text-stone-400" /> ~{selectedConcept.estimatedTimeMin} mins
                </span>
              </div>
            </div>

            {/* Prerequisite Chain Status */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 block">
                Prerequisite Dependency Chain:
              </span>
              {selectedConcept.prerequisites.length === 0 ? (
                <div className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-lg p-2 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Foundational Topic: No prerequisites required.</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {selectedConcept.prerequisites.map((pid) => {
                    const prereqNode = concepts.find((c) => c.id === pid);
                    const isMet = (prereqNode?.masteryScore || 0) >= 80;
                    return (
                      <div
                        key={pid}
                        className={`text-xs p-2 rounded-lg border flex items-center justify-between ${
                          !isLoggedIn
                            ? 'bg-stone-50 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
                            : isMet
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-300'
                            : 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-300'
                        }`}
                      >
                        <span className="font-medium truncate mr-2">
                          {prereqNode?.title || pid}
                        </span>
                        <span className="text-[10px] font-mono shrink-0">
                          {isLoggedIn ? `${prereqNode?.masteryScore || 0}% ${isMet ? '✓ Met' : '⚠ Gap'}` : 'Prerequisite'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Decision Engine Scaffolding Note */}
            <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#114B43] dark:text-[#34D399]" />
                <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                  Study Guidance
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                {!isLoggedIn
                  ? 'Sign in as a student to receive lessons tailored to your interests and track your chapter mastery.'
                  : selectedConcept.status === 'mastered'
                  ? 'Topic mastered (≥80%). Upcoming chapters and lessons are now unlocked.'
                  : selectedConcept.status === 'prerequisite_gap'
                  ? 'Prerequisite topic needs review. We recommend practicing foundational topics first.'
                  : selectedConcept.status === 'remediation'
                  ? 'Recommended review: Concept explanations tailored with real-world examples.'
                  : 'Ready to learn: Start the micro-lesson or take the practice quiz to check your understanding.'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                id="btn-start-adaptive-lesson"
                onClick={() => onStartLesson(selectedConcept.id)}
                className="w-full py-2.5 px-4 bg-[#114B43] hover:bg-[#0D3F38] text-white rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer active:scale-98"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Launch Micro-Lesson</span>
              </button>

              <button
                id="btn-start-adaptive-assessment"
                onClick={() => onStartAssessment(selectedConcept.id)}
                className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 dark:bg-stone-800 dark:hover:bg-stone-700 text-white rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 border border-transparent dark:border-stone-700 shadow-2xs cursor-pointer active:scale-98"
              >
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Take Mastery Check</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
