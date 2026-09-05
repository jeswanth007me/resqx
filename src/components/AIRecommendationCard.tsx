import type { AIRecommendation } from '../types/ai';

interface AIRecommendationCardProps {
  recommendation: AIRecommendation;
  onExecute?: () => void;
  onDismiss?: () => void;
}

export function AIRecommendationCard({ recommendation, onExecute, onDismiss }: AIRecommendationCardProps) {
  const isDismissed = recommendation.action === 'DISMISS';

  return (
    <div className="bg-[#171717] border border-[#242424] rounded p-4 flex flex-col justify-between select-none">
      <div>
        <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#242424]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[#d97706]">psychology</span>
            <span className="font-mono text-[11px] font-bold tracking-widest text-[#F5F5F5] uppercase">
              AI DECISION ENGINE
            </span>
          </div>
          <span className="font-mono text-[10px] text-[#d97706] font-bold px-2 py-0.5 rounded bg-[#d97706]/15 border border-[#d97706]/30">
            {recommendation.confidence}% CONFIDENCE
          </span>
        </div>

        <div className="bg-[#141414] border border-[#1e1e1e] p-3 rounded mb-3">
          <div className="font-mono text-[10px] text-[#737373] uppercase mb-1">
            TARGET: {recommendation.targetSignal || 'CORRIDOR OPTIMIZATION'}
          </div>
          <p className="font-mono text-[12px] text-[#F5F5F5] leading-relaxed">
            {recommendation.recommendation}
          </p>
          <p className="font-mono text-[10px] text-[#A3A3A3] mt-1">
            {recommendation.reason}
          </p>
        </div>
      </div>

      {!isDismissed ? (
        <div className="flex gap-2">
          <button
            onClick={onExecute}
            className="flex-1 bg-[#d04848] hover:bg-[#e15252] text-white font-mono text-[11px] font-bold py-2 px-3 rounded transition-colors cursor-pointer border border-[#e15252] flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[14px]">bolt</span>
            EXECUTE OVERRIDE
          </button>
          <button
            onClick={onDismiss}
            className="px-3 bg-[#242424] hover:bg-[#2a2a2a] text-[#A3A3A3] hover:text-[#F5F5F5] font-mono text-[11px] py-2 rounded transition-colors cursor-pointer border border-[#333333]"
          >
            DISMISS
          </button>
        </div>
      ) : (
        <div className="text-center font-mono text-[10px] text-[#737373] py-1 bg-[#141414] rounded border border-[#1e1e1e]">
          MONITORING CORRIDOR STATUS (DISMISSED)
        </div>
      )}
    </div>
  );
}
