/**
 * ResQX Traffic Police Coordination & Emergency Alert Card
 *
 * Operational UI displaying junction officer assignments, ETA countdowns,
 * real-time alert dispatch states, and manual acknowledgement verification.
 */

import { useState } from 'react';
import type { JunctionAssignment, EmergencyAlert } from '../types/police';
import { getAlertService } from '../services/alertService';
import type { DispatchedAlertRecord } from '../App';

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
    <div className="bg-[#171717] border border-[#242424] rounded p-4 flex flex-col select-none">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#242424]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-[#38a169]">local_police</span>
          <span className="font-mono text-[11px] font-bold tracking-widest text-[#F5F5F5] uppercase">
            POLICE JUNCTION DISPATCH
          </span>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border bg-[#38a169]/15 text-[#38a169] border-[#38a169]/30">
          NTFY 4-JUNCTION DISPATCH
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {assignments.map((assignment) => {
          const alert = alerts.find((a) => a.junctionId === assignment.junctionId || a.signalId === assignment.signalId);
          const alertId = alert?.alertId ?? `ALERT-${assignment.signalId}`;
          const isAck = acknowledgedSet.has(alertId) || acknowledgedSet.has(assignment.junctionId) || alert?.status === 'ACKNOWLEDGED';
          const sigTelemetry = telemetry?.signals.find((s) => s.id === assignment.signalId);
          const sigState = sigTelemetry?.emergencyState;
          const hasAlertRecord = dispatchedAlerts.some((a) => a.signalId === assignment.signalId);
          const isPriority = sigState === 'EMERGENCY PRIORITY' || sigState === 'PRIORITY' || sigState === 'PASSING';
          const isPreparing = sigState === 'PREPARING';
          const isRestored = sigState === 'RESTORED' || sigState === 'RESTORING';

          const statusText = isAck
            ? 'ACKNOWLEDGED'
            : assignment.status === 'UNASSIGNED'
            ? 'NO OFFICER'
            : hasAlertRecord
            ? 'NTFY ALERT DISPATCHED'
            : isPriority
            ? 'PRIORITY ACTIVE'
            : isPreparing
            ? 'PREPARING'
            : isRestored
            ? 'RESTORED'
            : 'STANDBY';

          const dotColor = isAck
            ? 'bg-[#38a169]'
            : assignment.status === 'UNASSIGNED'
            ? 'bg-[#d04848]'
            : hasAlertRecord || isPriority
            ? 'bg-[#38a169] animate-pulse shadow-[0_0_6px_#38a169]'
            : isPreparing
            ? 'bg-[#d97706] animate-pulse shadow-[0_0_6px_#d97706]'
            : isRestored
            ? 'bg-[#06b6d4]'
            : 'bg-[#737373]';

          return (
            <div
              key={assignment.junctionId}
              className="p-2.5 rounded bg-[#141414] border border-[#1e1e1e] flex flex-col gap-1 font-mono text-[11px]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[10px] text-[#F5F5F5] bg-[#222222] px-1.5 py-0.5 rounded border border-[#333333]">
                    {assignment.signalId}
                  </span>
                  <span className="text-[11px] font-semibold text-[#F5F5F5]">
                    {assignment.officerName ?? 'Insp. Rajesh Kumar'}
                  </span>
                </div>
                <span className="text-[11px] text-[#38a169] font-bold">
                  ETA {assignment.etaSeconds}s
                </span>
              </div>

              {assignment.badgeNumber && (
                <div className="flex items-center justify-between text-[10px] text-[#737373]">
                  <span>{assignment.badgeNumber}</span>
                  <span>{assignment.contactIdentifier}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-[#1e1e1e] text-[10px]">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                  <span className="font-bold text-[#A3A3A3]">
                    {statusText}
                  </span>
                </div>

                {!isAck && assignment.status !== 'UNASSIGNED' && (
                  <button
                    onClick={() => handleAcknowledge(alertId, assignment.junctionId)}
                    className="text-[9px] px-2 py-0.5 rounded bg-[#38a169]/15 text-[#38a169] hover:bg-[#38a169]/25 border border-[#38a169]/30 transition-colors cursor-pointer"
                  >
                    Ack
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
