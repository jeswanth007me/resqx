/**
 * ResQX Traffic Police Coordination & Emergency Alert Card
 *
 * Operational EOC card displaying junction officer assignments, ETA countdowns,
 * real-time alert dispatch states, and manual acknowledgement verification.
 */

import { useState } from 'react';
import { Radio } from 'lucide-react';
import type { JunctionAssignment, EmergencyAlert } from '../types/police';
import { getAlertService } from '../services/alertService';
import type { DispatchedAlertRecord } from '../App';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tooltip } from './ui/tooltip';

interface PoliceCoordinationCardProps {
  assignments?: JunctionAssignment[];
  alerts?: EmergencyAlert[];
  dispatchedAlerts?: DispatchedAlertRecord[];
  onAlertAcknowledged?: (alertId: string) => void;
  telemetry?: import('../types/telemetry').TelemetryData | null;
}

export function PoliceCoordinationCard({
  assignments = [],
  alerts = [],
  dispatchedAlerts = [],
  onAlertAcknowledged,
  telemetry = null,
}: PoliceCoordinationCardProps) {
  const [acknowledgedSet, setAcknowledgedSet] = useState<Set<string>>(new Set());
  const alertService = getAlertService();

  const handleAcknowledge = async (alertId: string, junctionId: string) => {
    await alertService.acknowledgeAlert(alertId);
    setAcknowledgedSet((prev) => new Set(prev).add(alertId).add(junctionId));
    onAlertAcknowledged?.(alertId);
  };

  return (
    <Card className="border-gray-800 bg-gray-900/95 flex flex-col justify-between">
      <div>
        <CardHeader className="py-2.5 px-3.5 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-gray-100">Police Coordination</CardTitle>
            <Tooltip content="Junction traffic officer assignments & live ntfy emergency dispatch">
              <span className="text-[10px] text-gray-500 font-mono cursor-help">ⓘ</span>
            </Tooltip>
          </div>
          <Badge variant="info">
            ntfy Active
          </Badge>
        </CardHeader>

        <CardContent className="p-3.5 space-y-2 font-mono">
          {assignments.length === 0 ? (
            <div className="text-xs text-gray-500 py-3 text-center">
              Awaiting corridor officer assignments...
            </div>
          ) : (
            assignments.map((assignment) => {
              const alert = alerts.find(
                (a) => a.junctionId === assignment.junctionId || a.signalId === assignment.signalId
              );
              const alertId = alert?.alertId ?? `ALERT-${assignment.signalId}`;
              const isAck =
                acknowledgedSet.has(alertId) ||
                acknowledgedSet.has(assignment.junctionId) ||
                alert?.status === 'ACKNOWLEDGED';
              const sigTelemetry = telemetry?.signals.find((s) => s.id === assignment.signalId);
              const sigState = sigTelemetry?.emergencyState;
              const hasAlertRecord = dispatchedAlerts.some((a) => a.signalId === assignment.signalId);
              const isPriority =
                sigState === 'EMERGENCY PRIORITY' || sigState === 'PRIORITY' || sigState === 'PASSING';
              const isPreparing = sigState === 'PREPARING';
              const isRestored = sigState === 'RESTORED' || sigState === 'RESTORING';

              const statusText = isAck
                ? 'ACKNOWLEDGED'
                : assignment.status === 'UNASSIGNED'
                ? 'NO OFFICER'
                : hasAlertRecord
                ? 'NTFY DISPATCHED'
                : isPriority
                ? 'PRIORITY ACTIVE'
                : isPreparing
                ? 'PREPARING'
                : isRestored
                ? 'RESTORED'
                : 'STANDBY';

              let badgeVariant: 'success' | 'warning' | 'info' | 'destructive' | 'muted' = 'muted';
              let dotColor = 'bg-gray-600';

              if (isAck) {
                badgeVariant = 'success';
                dotColor = 'bg-emerald-400';
              } else if (assignment.status === 'UNASSIGNED') {
                badgeVariant = 'destructive';
                dotColor = 'bg-red-400';
              } else if (hasAlertRecord || isPriority) {
                badgeVariant = 'success';
                dotColor = 'bg-emerald-400 animate-pulse';
              } else if (isPreparing) {
                badgeVariant = 'warning';
                dotColor = 'bg-amber-400 animate-pulse';
              } else if (isRestored) {
                badgeVariant = 'info';
                dotColor = 'bg-sky-400';
              }

              return (
                <div
                  key={assignment.junctionId}
                  className="p-2 rounded bg-gray-950/70 border border-gray-800/80 flex items-center justify-between gap-2 text-[11px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-[10px] text-gray-200 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800 shrink-0">
                      {assignment.signalId}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-200 text-xs truncate">
                        {assignment.officerName ?? 'Insp. Rajesh Kumar'}
                      </div>
                      <div className="text-[9px] text-gray-500 truncate">
                        {assignment.badgeNumber ? `Badge ${assignment.badgeNumber}` : 'Traffic Officer'} • {assignment.contactIdentifier}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-end">
                      <span className="text-emerald-400 font-bold text-[10px] font-mono">
                        ETA {assignment.etaSeconds}s
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                        <Badge variant={badgeVariant} className="text-[8px] py-0 px-1 font-bold">
                          {statusText}
                        </Badge>
                      </div>
                    </div>

                    {!isAck && assignment.status !== 'UNASSIGNED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAcknowledge(alertId, assignment.junctionId)}
                        className="h-5 px-2 text-[9px] text-emerald-400 border-emerald-800/60 hover:bg-emerald-950/30"
                      >
                        Ack
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </div>

      <div className="p-3.5 pt-0 text-[10px] font-mono text-gray-500 border-t border-gray-800/60 mt-1 flex items-center justify-between">
        <span>Junction Officer Deployment</span>
        <span className="text-emerald-400 font-semibold">Realtime Dispatch</span>
      </div>
    </Card>
  );
}
