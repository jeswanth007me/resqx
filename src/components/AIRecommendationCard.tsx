import { useLocale } from '../i18n/useLocale';
import type { AIRecommendation } from '../types/ai';

interface AIRecommendationCardProps {
  recommendation: AIRecommendation;
  onExecute?: () => void;
  onDismiss?: () => void;
}

export function AIRecommendationCard({ recommendation, onExecute, onDismiss }: AIRecommendationCardProps) {
  const { t } = useLocale();

  return (
    <div className="p-[var(--spacing-margin)] border-b border-surface-variant/50 bg-tertiary-container/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-headline text-sm font-semibold text-tertiary flex items-center gap-2 uppercase tracking-wide">
          <span className="material-symbols-outlined text-[18px]">psychology</span>
          {t.ai.intelligence}
        </h3>
        <div className="font-data text-xs font-semibold text-tertiary">
          {recommendation.confidence}% {t.ai.confidence}
        </div>
      </div>

      {/* Recommendation Card */}
      <div className="bg-surface-container-highest p-4 rounded-xl shadow-md border-l-2 border-tertiary relative overflow-hidden">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-tertiary/5 to-transparent pointer-events-none" />

        <p className="font-body text-sm text-on-surface relative z-10">
          Recommendation:{' '}
          <span className="font-headline font-semibold text-on-surface">
            {recommendation.recommendation}
          </span>
          {' '}
          {recommendation.reason.split('.')[0]}.
        </p>

        {/* Action buttons */}
        <div className="mt-3 flex gap-2 relative z-10">
          <button
            onClick={onExecute}
            className="flex-1 bg-tertiary text-on-tertiary font-data text-xs font-semibold py-2 rounded shadow-sm hover:brightness-110 transition-all border-none cursor-pointer"
          >
            {t.ai.executeOverride}
          </button>
          <button
            onClick={onDismiss}
            className="px-3 bg-surface-container text-on-surface font-data text-xs font-semibold py-2 rounded hover:bg-surface-variant transition-all border-none cursor-pointer"
          >
            {t.ai.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
