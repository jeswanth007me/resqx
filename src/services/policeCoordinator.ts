/**
 * ResQX Traffic Police Coordination Engine
 *
 * Handles junction-officer mapping, deterministic on-duty selection,
 * duplicate alert prevention, and alert payload generation.
 */

import type { TrafficOfficer, JunctionAssignment, EmergencyAlert, AlertPriority } from '../types/police.ts';
import type { CorridorPlan } from '../types/corridor.ts';

export const DEFAULT_OFFICERS: TrafficOfficer[] = [
  {
    officerId: 'OFFICER-01',
    name: 'Insp. Rajesh Kumar',
    badgeNumber: 'TP-4021',
    contactIdentifier: '+91-98765-XXXX1',
    assignedJunctionIds: ['SIG-01', 'SIG-02'],
    status: 'ON_DUTY',
    stationName: 'North Traffic Division',
  },
  {
    officerId: 'OFFICER-02',
    name: 'Sub-Insp. Priya Sharma',
    badgeNumber: 'TP-4088',
    contactIdentifier: '+91-98765-XXXX2',
    assignedJunctionIds: ['SIG-02', 'SIG-03'],
    status: 'ON_DUTY',
    stationName: 'Central Traffic Hub',
  },
  {
    officerId: 'OFFICER-03',
    name: 'Const. Vikram Singh',
    badgeNumber: 'TP-4105',
    contactIdentifier: '+91-98765-XXXX3',
    assignedJunctionIds: ['SIG-03', 'SIG-04'],
    status: 'ON_DUTY',
    stationName: 'South Traffic Post',
  },
  {
    officerId: 'OFFICER-04-OFFDUTY',
    name: 'Insp. Amit Verma',
    badgeNumber: 'TP-4010',
    contactIdentifier: '+91-98765-XXXX4',
    assignedJunctionIds: ['SIG-01'],
    status: 'OFF_DUTY',
    stationName: 'North Traffic Division',
  },
];

export class PoliceCoordinator {
  private officers: Map<string, TrafficOfficer> = new Map();
  private sentAlertKeys: Set<string> = new Set();

  constructor(initialOfficers: TrafficOfficer[] = DEFAULT_OFFICERS) {
    for (const officer of initialOfficers) {
      this.officers.set(officer.officerId, { ...officer });
    }
  }

  public getAllOfficers(): TrafficOfficer[] {
    return Array.from(this.officers.values());
  }

  public getOfficer(officerId: string): TrafficOfficer | undefined {
    return this.officers.get(officerId);
  }

  public setOfficerStatus(officerId: string, status: TrafficOfficer['status']): boolean {
    const officer = this.officers.get(officerId);
    if (!officer) return false;
    officer.status = status;
    return true;
  }

  /**
   * Deterministically selects the best available on-duty officer for a specific junction/signal.
   */
  public selectOfficerForJunction(signalId: string): TrafficOfficer | null {
    const candidates = Array.from(this.officers.values()).filter(
      (off) => off.assignedJunctionIds.includes(signalId) && off.status === 'ON_DUTY'
    );

    if (candidates.length === 0) {
      return null;
    }

    // Deterministic selection: pick first matching on-duty officer
    return candidates[0];
  }

  /**
   * Assigns officers to all upcoming controlled junctions in an Emergency Corridor.
   */
  public assignOfficersForCorridor(
    corridor: CorridorPlan,
    emergencyId: string,
    currentSimulationTime: number = 0
  ): JunctionAssignment[] {
    const assignments: JunctionAssignment[] = [];

    for (const signalPlan of corridor.signals) {
      const officer = this.selectOfficerForJunction(signalPlan.signalId);

      if (officer) {
        assignments.push({
          junctionId: signalPlan.signalId,
          signalId: signalPlan.signalId,
          officerId: officer.officerId,
          officerName: officer.name,
          badgeNumber: officer.badgeNumber,
          contactIdentifier: officer.contactIdentifier,
          assignmentReason: `Primary on-duty officer covering ${signalPlan.signalName} (${signalPlan.signalId})`,
          emergencyId,
          etaSeconds: Math.round(signalPlan.predictedArrivalSeconds * 10) / 10,
          assignedAt: currentSimulationTime,
          status: 'ASSIGNED',
        });
      } else {
        assignments.push({
          junctionId: signalPlan.signalId,
          signalId: signalPlan.signalId,
          officerId: null,
          officerName: null,
          badgeNumber: null,
          contactIdentifier: null,
          assignmentReason: `NO_OFFICER_AVAILABLE: No on-duty traffic officer covering ${signalPlan.signalId}`,
          emergencyId,
          etaSeconds: Math.round(signalPlan.predictedArrivalSeconds * 10) / 10,
          assignedAt: currentSimulationTime,
          status: 'UNASSIGNED',
        });
      }
    }

    return assignments;
  }

  /**
   * Generates a typed EmergencyAlert for an assigned junction.
   * Returns null if junction is unassigned.
   */
  public createEmergencyAlert(
    assignment: JunctionAssignment,
    priority: AlertPriority = 'HIGH',
    timestamp: number = Date.now()
  ): EmergencyAlert | null {
    if (assignment.status === 'UNASSIGNED' || !assignment.officerId || !assignment.officerName) {
      return null;
    }

    const etaMin = Math.floor(assignment.etaSeconds / 60);
    const etaSec = Math.floor(assignment.etaSeconds % 60);
    const formattedEta = `${etaMin.toString().padStart(2, '0')}:${etaSec.toString().padStart(2, '0')}`;

    const message = [
      `🚨 RESQX EMERGENCY CORRIDOR ALERT`,
      `Emergency: ${assignment.emergencyId}`,
      `Junction: ${assignment.signalId}`,
      `ETA: ${assignment.etaSeconds}s (${formattedEta})`,
      `Priority: ${priority}`,
      `Action: Green wave priority active. Please clear cross-traffic and ensure safe passage.`,
    ].join('\n');

    return {
      alertId: `ALERT-${assignment.emergencyId}-${assignment.signalId}-${timestamp}`,
      emergencyId: assignment.emergencyId,
      junctionId: assignment.junctionId,
      signalId: assignment.signalId,
      officerId: assignment.officerId,
      officerName: assignment.officerName,
      contactIdentifier: assignment.contactIdentifier ?? '+91-98765-XXXXX',
      etaSeconds: assignment.etaSeconds,
      formattedEta,
      priority,
      message,
      status: 'PENDING',
      mode: 'DEMO',
      timestamp,
    };
  }

  /**
   * Checks if an alert has already been sent for this emergency & junction pair to avoid spamming.
   */
  public shouldSendAlert(emergencyId: string, signalId: string): boolean {
    const key = `${emergencyId}_${signalId}`;
    return !this.sentAlertKeys.has(key);
  }

  /**
   * Records that an alert was dispatched for deduplication.
   */
  public markAlertSent(emergencyId: string, signalId: string): void {
    const key = `${emergencyId}_${signalId}`;
    this.sentAlertKeys.add(key);
  }

  /**
   * Resets alert deduplication history (e.g. on simulation reset).
   */
  public resetHistory(): void {
    this.sentAlertKeys.clear();
  }
}
