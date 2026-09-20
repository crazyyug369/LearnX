import React, { useState, useEffect } from 'react';
import {
  Youtube,
  ExternalLink,
  Play,
  X,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Volume2,
} from 'lucide-react';
import { Question } from '../types';
import {
  getYouTubeReferenceForQuestion,
  YouTubeReference,
  openYouTubeReference,
} from '../utils/youtubeReference';

interface YouTubeRemediationCardProps {
  question: Question;
  selectedOptionIndex: number;
  autoRedirectEnabled: boolean;
  onToggleAutoRedirect?: (enabled: boolean) => void;
  onRetakeOrReview?: () => void;
}

export const YouTubeRemediationCard: React.FC<YouTubeRemediationCardProps> = ({
  question,
  selectedOptionIndex,
  autoRedirectEnabled,
  onToggleAutoRedirect,
  onRetakeOrReview,
}) => {
  const [showInAppPlayer, setShowInAppPlayer] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [redirectCancelled, setRedirectCancelled] = useState(false);

  const selectedAnswer = question.options[selectedOptionIndex];
  const correctAnswer = question.options[question.correctIndex];

  const ytRef: YouTubeReference = getYouTubeReferenceForQuestion(
    question,
    selectedAnswer
  );

  // Auto-redirect countdown logic
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
          // Perform redirect to YouTube
          openYouTubeReference(ytRef.directUrl);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRedirectEnabled, redirectCancelled, ytRef.directUrl]);

  const handleManualOpen = (e: React.MouseEvent) => {
    // Open in new tab
    openYouTubeReference(ytRef.directUrl);
  };

  const handleCancelCountdown = () => {
    setRedirectCancelled(true);
    setCountdown(null);
  };

  return (
    <div
      id="youtube-remediation-card"
      className="mt-4 rounded-xl border-2 border-rose-200 bg-linear-to-b from-rose-50/60 to-white p-4 sm:p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-300"
    >
      {/* Top Banner with YouTube Badge & Auto-Redirect Status */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-rose-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-xs">
            <Youtube className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-red-700 tracking-wide uppercase">
                Video Lesson & Walkthrough
              </span>
              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-semibold">
                Reference
              </span>
            </div>
            <p className="text-[11px] text-stone-600">
              Matched lesson for your missed question
            </p>
          </div>
        </div>

        {/* Auto-redirect Toggle */}
        <div className="flex items-center gap-2">
          {onToggleAutoRedirect && (
            <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer select-none bg-white px-2.5 py-1 rounded-md border border-stone-200 shadow-2xs hover:bg-stone-50">
              <input
                type="checkbox"
                id="toggle-auto-redirect-yt"
                checked={autoRedirectEnabled}
                onChange={(e) => onToggleAutoRedirect(e.target.checked)}
                className="rounded text-red-600 focus:ring-red-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span className="text-[11px] font-medium">Auto-open on error</span>
            </label>
          )}
        </div>
      </div>

      {/* Auto-Redirect Active Countdown Bar */}
      {countdown !== null && countdown > 0 && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-200 flex items-center justify-between gap-3 text-red-950 text-xs animate-pulse">
          <div className="flex items-center gap-2">
            <Youtube className="w-4 h-4 text-red-600" />
            <span>
              Redirecting to YouTube reference in{' '}
              <strong className="font-bold text-red-700 text-sm">
                {countdown}s
              </strong>
              ...
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={ytRef.directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-medium text-[11px] transition-colors"
            >
              Open Now
            </a>
            <button
              onClick={handleCancelCountdown}
              className="px-2 py-1 text-stone-600 hover:text-stone-900 text-[11px] font-medium underline cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Misconception Reference Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-lg bg-rose-50/80 border border-rose-200/80 text-rose-950 space-y-0.5">
          <span className="text-[10px] font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-600" /> Your Answer
          </span>
          <p className="font-medium text-xs line-clamp-2">{selectedAnswer}</p>
        </div>

        <div className="p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-emerald-950 space-y-0.5">
          <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Correct Answer
          </span>
          <p className="font-medium text-xs line-clamp-2">{correctAnswer}</p>
        </div>
      </div>

      {/* Video Reference Metadata & Explanation */}
      <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-2 shadow-2xs">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-medium text-red-700 uppercase tracking-wider bg-red-50 px-1.5 py-0.5 rounded">
              {ytRef.channelName}
            </span>
            <h4 className="text-sm font-semibold text-stone-900 mt-1 leading-snug">
              {ytRef.videoTitle}
            </h4>
          </div>
        </div>

        <p className="text-xs text-stone-600 leading-relaxed">
          <strong className="text-stone-800">Why this video:</strong>{' '}
          {ytRef.relevanceExplanation}
        </p>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center gap-2.5">
          {/* Main Redirect to YouTube button */}
          <a
            id="btn-open-youtube-reference"
            href={ytRef.directUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleManualOpen}
            className="flex-1 min-w-[200px] py-2.5 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer"
            title="Open explanation video directly on YouTube in new tab"
          >
            <Youtube className="w-4 h-4 fill-white" />
            <span>Open on YouTube (New Tab)</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>

          {/* In-App Player Toggle */}
          <button
            id="btn-toggle-inapp-player"
            type="button"
            onClick={() => setShowInAppPlayer(!showInAppPlayer)}
            className="py-2.5 px-3.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-stone-700" />
            <span>{showInAppPlayer ? 'Hide Player' : 'Watch In-App'}</span>
          </button>

          {/* Search Query Link */}
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
      </div>

      {/* Embedded In-App YouTube Player */}
      {showInAppPlayer && (
        <div className="rounded-xl overflow-hidden border border-stone-300 bg-stone-900 shadow-md animate-in fade-in duration-200">
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
  );
};
