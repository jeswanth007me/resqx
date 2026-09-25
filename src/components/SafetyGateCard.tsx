import { ShieldCheck, ShieldAlert, Shield, CheckCircle2, XCircle } from 'lucide-react';
import type { SafetyValidationResult } from '../types/safety';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Tooltip } from './ui/tooltip';

interface SafetyGateCardProps {
  safetyValidation: SafetyValidationResult | null;
}

export function SafetyGateCard({ safetyValidation }: SafetyGateCardProps) {
  if (!safetyValidation) {
    return (
      <Card className="border-gray-800 bg-gray-900/95 flex flex-col justify-between">
        <CardHeader className="py-2.5 px-3.5 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <CardTitle className="text-gray-100">Safety Gate</CardTitle>
            <Tooltip content="Deterministic safety validation interlock">
              <span className="text-[10px] text-gray-500 font-mono cursor-help">ⓘ</span>
            </Tooltip>
          </div>
          <Badge variant="warning">HOLD</Badge>
        </CardHeader>
        <CardContent className="p-3.5 text-xs font-mono text-gray-400">
          Awaiting active corridor plan for deterministic safety verification...
        </CardContent>
      </Card>
    );
  }

  const { decision, allSafe, approvedCommands, blockedCommands, validationNotes, safetySummary } =
    safetyValidation;

  const isApproved = decision === 'APPROVED';
  const isBlocked = decision === 'BLOCKED';

  const badgeVariant = isApproved ? 'success' : isBlocked ? 'destructive' : 'warning';
  const Icon = isApproved ? ShieldCheck : isBlocked ? ShieldAlert : Shield;
  const iconColor = isApproved ? 'text-emerald-400' : isBlocked ? 'text-rose-400' : 'text-amber-400';

  return (
    <Card className="border-gray-800 bg-gray-900/95 flex flex-col justify-between">
      <CardHeader className="py-2.5 px-3.5 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          <CardTitle className="text-gray-100">
            <span>Safety Gate</span>
          </CardTitle>
          <Tooltip content="Strict deterministic interlock preventing conflicting traffic preemption">
            <span className="text-[10px] text-gray-500 font-mono cursor-help">ⓘ</span>
          </Tooltip>
        </div>
        <Badge variant={badgeVariant} className="font-bold tracking-wider">
          {decision}
        </Badge>
      </CardHeader>

      <CardContent className="p-3.5 space-y-2.5 font-mono">
        {/* Core Interlock State Banner */}
        <div
          className={`flex items-center justify-between px-2.5 py-1.5 rounded border text-[11px] ${
            allSafe
              ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
              : 'bg-rose-950/30 border-rose-800/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {allSafe ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span className="font-semibold">
              {allSafe ? 'Interlock Active • Preemption Allowed' : 'Safety Violation • Action Blocked'}
            </span>
          </div>
          <span className="text-[10px] opacity-80">
            {isApproved ? 'VERIFIED' : 'REJECTED'}
          </span>
        </div>

        {/* Safety Summary Text */}
        {safetySummary && (
          <div className="text-[11px] text-gray-400 bg-gray-950/70 p-2 rounded border border-gray-800/80">
            <span className="text-gray-500 text-[9px] uppercase tracking-wider block mb-0.5">
              Validator Verdict
            </span>
            <span className="text-gray-300">{safetySummary}</span>
          </div>
        )}

        {/* Real Authorized Commands List (when they actually exist) */}
        {approvedCommands.length > 0 && (
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase tracking-wider mb-1">
              <span>Authorized Signal Preemptions</span>
              <span className="text-emerald-400 font-bold">{approvedCommands.length} Authorized</span>
            </div>
            <div className="space-y-1.5">
              {approvedCommands.map((cmd) => (
                <div
                  key={cmd.signalId}
                  className="bg-gray-950/80 border border-gray-800/90 rounded px-2.5 py-1.5 flex items-center justify-between text-[10px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-200">{cmd.signalId}</span>
                    <span className="text-gray-500 truncate max-w-[120px]">{cmd.signalName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-semibold">
                      {cmd.authorizedPhase} ({cmd.sumoStatePattern})
                    </span>
                    <span className="text-gray-500">≤{cmd.timeoutSeconds}s</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Real Blocked Commands List (when they actually exist) */}
        {blockedCommands.length > 0 && (
          <div>
            <div className="flex items-center justify-between text-[10px] text-rose-400 uppercase tracking-wider mb-1">
              <span>Blocked Commands</span>
              <span className="font-bold">{blockedCommands.length} Rejected</span>
            </div>
            <div className="space-y-1.5">
              {blockedCommands.map((cmd) => (
                <div
                  key={cmd.signalId}
                  className="bg-rose-950/20 border border-rose-900/40 rounded px-2.5 py-1.5 text-[10px] text-rose-300"
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{cmd.signalId}</span>
                    <span className="text-rose-400">{cmd.decision}</span>
                  </div>
                  <div className="text-[9px] text-rose-400/90 mt-0.5">
                    {cmd.rejectionReasons.join(' • ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Real Validation Notes (when present) */}
        {validationNotes.length > 0 && (
          <div className="pt-1 border-t border-gray-800/60 text-[9px] text-gray-500 space-y-0.5">
            {validationNotes.slice(0, 2).map((note, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-gray-600" />
                <span className="truncate">{note}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
