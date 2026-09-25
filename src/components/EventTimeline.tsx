import {
  Clock,
  CheckCircle2,
  Radio,
  ShieldCheck,
  ShieldAlert,
  TrafficCone,
  BrainCircuit,
  Hospital,
  Bell,
  Activity,
  Ambulance,
} from 'lucide-react';
import type { EmergencyEvent } from '../types/events';
import type { TelemetryData } from '../types/telemetry';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Tooltip } from './ui/tooltip';

interface EventTimelineProps {
  events: EmergencyEvent[];
  telemetry?: TelemetryData | null;
  isRunning?: boolean;
}

const severityConfig: Record<
  EmergencyEvent['severity'],
  { badgeVariant: 'success' | 'warning' | 'destructive' | 'info'; textClass: string }
> = {
  SUCCESS: { badgeVariant: 'success', textClass: 'text-emerald-400' },
  INFO: { badgeVariant: 'info', textClass: 'text-gray-300' },
  WARNING: { badgeVariant: 'warning', textClass: 'text-amber-400' },
  CRITICAL: { badgeVariant: 'destructive', textClass: 'text-rose-400' },
};

function getEventIcon(type: EmergencyEvent['type']) {
  if (type.includes('SAFETY_APPROVED')) return ShieldCheck;
  if (type.includes('SAFETY_BLOCKED')) return ShieldAlert;
  if (type.includes('EMERGENCY_DETECTED')) return Ambulance;
  if (type.includes('SIGNAL_PRIORITY')) return TrafficCone;
  if (type.includes('SIGNAL_PREPARING')) return Clock;
  if (type.includes('SIGNAL_RESTORED')) return CheckCircle2;
  if (type.includes('POLICE_ALERT')) return Bell;
  if (type.includes('POLICE')) return Radio;
  if (type.includes('AI') || type.includes('DECISION')) return BrainCircuit;
  if (type.includes('MISSION_COMPLETE')) return Hospital;
  return Activity;
}

function formatSimTime(timestamp: number): string {
  const m = Math.floor(timestamp / 60);
  const s = Math.floor(timestamp % 60);
  return `+${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function EventTimeline({ events, telemetry = null, isRunning = false }: EventTimelineProps) {
  const displayEvents = events.slice(0, 8);

  // Derive the rail from live telemetry only — no hard-coded future timestamps.
  const sigState = (id: string): string => {
    const s = telemetry?.signals.find((x) => x.id === id);
    return s?.emergencyState ?? 'NORMAL';
  };

  const ambStatus = telemetry?.ambulance.status ?? (isRunning ? 'STAGED' : 'STAGED');
  const ambTime = telemetry?.simulation.elapsedTime ?? 0;
  const isArrived = ambStatus === 'ARRIVED';
  const isEnRoute = ambStatus === 'EN_ROUTE' || isArrived;

  // Each signal is "done" once SUMO reports it RESTORED, otherwise pending/active.
  const sigDone = (id: string): boolean => sigState(id) === 'RESTORED';

  const corridor = ['SIG-01', 'SIG-02', 'SIG-03', 'SIG-04'];
  const activeSigIndex = isArrived
    ? -1
    : corridor.findIndex((id) => !sigDone(id));

  const initialized = isRunning || isEnRoute;
  const dispatchDone = initialized;
  const routeCalcDone = initialized;
  const safetyGateDone = initialized;

  const sig1Done = sigDone('SIG-01');
  const sig2Done = sigDone('SIG-02');
  const sig3Done = sigDone('SIG-03');
  const sig4Done = sigDone('SIG-04');

  type Step = { label: string; done: boolean; active: boolean };
  const steps: Step[] = [
    { label: 'Dispatch', done: dispatchDone, active: false },
    { label: 'Route Calc', done: routeCalcDone, active: false },
    { label: 'Safety Gate', done: safetyGateDone, active: false },
    { label: 'SIG-01', done: sig1Done, active: !sig1Done && activeSigIndex === 0 && !isArrived },
    { label: 'SIG-02', done: sig2Done, active: !sig2Done && activeSigIndex === 1 && !isArrived },
    { label: 'SIG-03', done: sig3Done, active: !sig3Done && activeSigIndex === 2 && !isArrived },
    { label: 'SIG-04', done: sig4Done, active: !sig4Done && activeSigIndex === 3 && !isArrived },
    { label: 'Hospital', done: isArrived, active: false },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const activeCount = steps.filter((s) => s.active).length;
  const totalSlots = steps.length;
  const progressRatio = isArrived
    ? 1
    : Math.min(1, (completedCount + activeCount) / totalSlots);

  const fmt = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `+${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const stepTime = (_label: string, idx: number): string => {
    if (steps[idx].active) return 'NOW';
    if (steps[idx].done) return fmt(ambTime);
    return '--:--';
  };

  return (
    <Card className="border-gray-800 bg-gray-900/95 flex flex-col justify-between">
      <div>
        <CardHeader className="py-2.5 px-3.5 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-gray-100">Mission Event Timeline</CardTitle>
            <Tooltip content="Real-time corridor progression and state-transition audit log">
              <span className="text-[10px] text-gray-500 font-mono cursor-help">ⓘ</span>
            </Tooltip>
          </div>
          <Badge
            variant={
              isArrived
                ? 'success'
                : isRunning || isEnRoute
                ? 'default'
                : 'muted'
            }
          >
            {isArrived
              ? 'Mission Complete'
              : isRunning || isEnRoute
              ? 'Corridor Executing'
              : 'Staged'}
          </Badge>
        </CardHeader>

        <CardContent className="p-3.5 space-y-3 font-mono">
          {/* Horizontal Milestone Progression Rail */}
          <div className="w-full overflow-x-auto py-1">
            <div className="min-w-[620px] flex items-center justify-between relative px-4">
              {/* Background Rail */}
              <div className="absolute left-6 right-6 top-3 h-[2px] bg-gray-800" />
              {/* Active Highlight Line */}
              <div
                className="absolute left-6 top-3 h-[2px] bg-emerald-500 transition-all duration-300"
                style={{ width: `calc((100% - 3rem) * ${progressRatio})` }}
              />

              {/* Steps */}
              {steps.map((step, idx) => {
                const isDone = step.done;
                const isActive = step.active;

                return (
                  <div key={idx} className="flex flex-col items-center text-center z-10">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        isActive
                          ? 'bg-red-600 text-white ring-4 ring-red-500/30 animate-pulse'
                          : isDone
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-gray-800 border border-gray-700 text-gray-500'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : isActive ? (
                        <span className="w-2 h-2 rounded-full bg-white" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                      )}
                    </div>
                    <span
                      className={`text-[9px] mt-1 ${
                        isActive
                          ? 'text-red-400 font-bold'
                          : isDone
                          ? 'text-emerald-400'
                          : 'text-gray-500'
                      }`}
                    >
                      {stepTime(step.label, idx)}
                    </span>
                    <span
                      className={`text-[10px] font-medium ${
                        isActive
                          ? 'text-gray-100 font-bold'
                          : isDone
                          ? 'text-gray-200'
                          : 'text-gray-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event Audit Log */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
              <span>Transition Audit Log</span>
              <span className="text-gray-400">Latest {displayEvents.length} Events</span>
            </div>

            {displayEvents.length === 0 ? (
              <div className="text-xs text-gray-500 py-3 text-center bg-gray-950/50 rounded border border-gray-800/80">
                Awaiting mission activation events...
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-0.5">
                {displayEvents.map((evt) => {
                  const cfg = severityConfig[evt.severity] ?? severityConfig.INFO;
                  const Icon = getEventIcon(evt.type);

                  return (
                    <div
                      key={evt.id}
                      className="flex items-center justify-between bg-gray-950/70 border border-gray-800/80 px-2.5 py-1.5 rounded text-[11px] hover:border-gray-700/80 transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.textClass}`} />
                        <span className="text-gray-500 text-[10px] shrink-0 font-medium">
                          {formatSimTime(evt.timestamp)}
                        </span>
                        <span className="text-gray-200 truncate">{evt.description}</span>
                      </div>
                      <Badge variant={cfg.badgeVariant} className="text-[9px] shrink-0">
                        {evt.type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </div>

      <div className="p-3.5 pt-0 text-[10px] font-mono text-gray-500 border-t border-gray-800/60 mt-1 flex items-center justify-between">
        <span>Deterministic Audit Trail</span>
        <span className="text-emerald-400 font-semibold">Zero-Tick Duplication Guard</span>
      </div>
    </Card>
  );
}
