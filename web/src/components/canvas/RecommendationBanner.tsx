"use client";

import { Sparkles, X, Check } from "lucide-react";
import type { StackRecommendation } from "@/lib/stack-recommend";
import { TechIcon } from "@/lib/tech-icons";

interface RecommendationBannerProps {
  recommendations: StackRecommendation[];
  onAccept: (techId: string) => void;
  onDismiss: () => void;
}

export default function RecommendationBanner({
  recommendations,
  onAccept,
  onDismiss,
}: RecommendationBannerProps) {
  if (recommendations.length === 0) return null;

  return (
    <div className="mx-2 mb-3 rounded-lg border border-amber-200/60 bg-amber-50/80 dark:border-amber-800/40 dark:bg-amber-950/40 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
          AI Recommendation
        </span>
        <button
          onClick={onDismiss}
          className="ml-auto p-0.5 rounded hover:bg-amber-200/50 dark:hover:bg-amber-800/50"
        >
          <X className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        </button>
      </div>

      <div className="space-y-2">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className="flex items-start gap-2 rounded-md bg-white/60 dark:bg-black/20 p-2"
          >
            <div className="mt-0.5 flex-shrink-0">
              <TechIcon catalogId={rec.techId} kind="backend" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-800 dark:text-slate-100">
                {rec.title}
              </p>
              <p className="text-sm text-[var(--muted)] dark:text-[var(--muted-fg)] mt-0.5">
                {rec.reason}
              </p>
            </div>
            <button
              onClick={() => onAccept(rec.techId)}
              className="flex-shrink-0 p-1 rounded bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors"
              title={`Add ${rec.title}`}
            >
              <Check className="h-3 w-3 text-amber-700 dark:text-amber-300" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
