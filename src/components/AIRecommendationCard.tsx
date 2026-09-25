import { BrainCircuit, Zap } from 'lucide-react';
import type { AIRecommendation } from '../types/ai';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tooltip } from './ui/tooltip';

interface AIRecommendationCardProps {
  recommendation: AIRecommendation;
  onExecute?: () => void;
  onDismiss?: () => void;
}

export function AIRecommendationCard({
  recommendation,
  onExecute,
  onDismiss,
}: AIRecommendationCardProps) {
  const isDismissed = recommendation.action === 'DISMISS';

  return (
    <Card className="border-gray-800 bg-gray-900/95 flex flex-col justify-between">
      <div>
        <CardHeader className="py-2.5 px-3.5 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-amber-400" />
            <CardTitle className="text-gray-100">AI Decision Engine</CardTitle>
            <Tooltip content="Autonomous corridor optimization and adaptive signal override suggestions">
              <span className="text-[10px] text-gray-500 font-mono cursor-help">ⓘ</span>
            </Tooltip>
          </div>
          <Badge variant="warning">{recommendation.confidence}% Confidence</Badge>
        </CardHeader>

        <CardContent className="p-3.5 space-y-2.5 font-mono">
          <div className="bg-gray-950/70 border border-gray-800/80 p-2.5 rounded">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              Target: {recommendation.targetSignal || 'Corridor Optimization'}
            </div>
            <p className="text-xs text-gray-200 leading-relaxed font-semibold">
              {recommendation.recommendation}
            </p>
            <p className="text-[11px] text-gray-400 mt-1 leading-normal">
              {recommendation.reason}
            </p>
          </div>
        </CardContent>
      </div>

      <div className="p-3.5 pt-0 font-mono">
        {!isDismissed ? (
          <div className="flex gap-2">
            <Button
              onClick={onExecute}
              variant="default"
              size="sm"
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold"
            >
              <Zap className="w-3.5 h-3.5" />
              Execute Override
            </Button>
            <Button
              onClick={onDismiss}
              variant="outline"
              size="sm"
              className="text-gray-400 hover:text-gray-200"
            >
              Dismiss
            </Button>
          </div>
        ) : (
          <div className="text-center text-[10px] text-gray-500 py-1.5 bg-gray-950/60 rounded border border-gray-800">
            Monitoring Corridor Status (Operator Dismissed)
          </div>
        )}
      </div>
    </Card>
  );
}
