/**
 * ResQX Traffic Police Coordination & Emergency Alert Card
 *
 * Operational UI displaying junction officer assignments, ETA countdowns,
 * real-time alert dispatch states, and manual acknowledgement verification.
 */

import { useState } from 'react';
import type { JunctionAssignment, EmergencyAlert } from '../types/police.ts';
import { getAlertService } from '../services/alertService.ts';

interface PoliceCoordinationCardProps {
  assignments?: JunctionAssignment[];
  alerts?: EmergencyAlert[];
  onAlertAcknowledged?: (alertId: string) => void;
}

export function PoliceCoordinationCard({
  assignments = [],
  alerts = [],
  onAlertAcknowledged,
}: PoliceCoordinationCardProps) {
  const [acknowledgedSet, setAcknowledgedSet] = useState<Set<string>>(new Set());
  const alertService = getAlertService();

  const handleAcknowledge = async (alertId: string, junctionId: string) => {
    await alertService.acknowledgeAlert(alertId);
    setAcknowledgedSet((prev) => new Set(prev).add(alertId).add(junctionId));
    onAlertAcknowledged?.(alertId);
  };

  if (assignments.length === 0 && alerts.length === 0) {
    return (
      <div className="p-4 border-b border-outline-variant/30 bg-surface-container-low/40">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-secondary text-sm font-bold">👮</span>
            <span className="font-headline text-xs font-bold text-on-surface tracking-wider uppercase">
              TRAFFIC POLICE COORDINATION
            </span>
          </div>
          <span className="text-[10px] font-data px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
            STANDBY
          </span>
        </div>
        <p className="text-xs text-on-surface-variant font-data">
          Awaiting emergency corridor generation for junction officer assignment.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-outline-variant/30 bg-surface-container-low/40">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-secondary text-sm font-bold">👮</span>
          <span className="font-headline text-xs font-bold text-on-surface tracking-wider uppercase">
            TRAFFIC POLICE COORDINATION
          </span>
        </div>
        <span
          className={`text-[10px] font-data font-bold px-2 py-0.5 rounded border ${
            alertService.mode === 'LIVE'
              ? 'bg-secondary/15 text-secondary border-secondary/30'
              : 'bg-primary-container/20 text-primary border-primary/30'
          }`}
        >
          {alertService.mode === 'LIVE' ? 'LIVE SMS MODE' : 'DEMO ALERT MODE'}
        </span>
      </div>

      <div className="space-y-2.5">
        {assignments.map((assignment) => {
          const alert = alerts.find((a) => a.junctionId === assignment.junctionId || a.signalId === assignment.signalId);
          const alertId = alert?.alertId ?? `ALERT-${assignment.signalId}`;
          const isAck = acknowledgedSet.has(alertId) || acknowledgedSet.has(assignment.junctionId) || alert?.status === 'ACKNOWLEDGED';

          return (
            <div
              key={assignment.junctionId}
              className="p-2.5 rounded-lg bg-surface-container-high/60 border border-outline-variant/30 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-data font-bold text-xs text-on-surface bg-surface-container-highest px-1.5 py-0.5 rounded">
                    {assignment.signalId}
                  </span>
                  <span className="text-xs font-semibold text-on-surface">
                    {assignment.officerName ?? 'Unassigned'}
                  </span>
                </div>
                <span className="text-xs font-data text-secondary font-bold">
                  ETA {assignment.etaSeconds}s
                </span>
              </div>

              {assignment.badgeNumber && (
                <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-data">
                  <span>Badge: {assignment.badgeNumber}</span>
                  <span>Contact: {assignment.contactIdentifier}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-outline-variant/20">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isAck
                        ? 'bg-secondary'
                        : assignment.status === 'UNASSIGNED'
                        ? 'bg-error'
                        : 'bg-tertiary animate-pulse'
                    }`}
                  />
                  <span className="text-[11px] font-data uppercase font-bold text-on-surface-variant">
                    {isAck
                      ? 'ACKNOWLEDGED'
                      : assignment.status === 'UNASSIGNED'
                      ? 'NO OFFICER'
                      : alertService.mode === 'LIVE'
                      ? 'SMS DISPATCHED'
                      : 'DEMO DISPATCHED'}
                  </span>
                </div>

                {!isAck && assignment.status !== 'UNASSIGNED' && (
                  <button
                    onClick={() => handleAcknowledge(alertId, assignment.junctionId)}
                    className="text-[10px] font-data px-2 py-0.5 rounded bg-secondary/15 text-secondary hover:bg-secondary/25 border border-secondary/30 transition-colors"
                  >
                    Ack Alert
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
