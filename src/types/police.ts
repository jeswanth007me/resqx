/**
 * ResQX Traffic Police Coordination & Emergency Alert Types
 *
 * Defines contracts for junction officer assignments, emergency alerts,
 * acknowledgement tracking, and alert dispatch service abstractions.
 */

export type OfficerDutyStatus = 'ON_DUTY' | 'OFF_DUTY' | 'BUSY';

export interface TrafficOfficer {
  officerId: string;
  name: string;
  badgeNumber: string;
  contactIdentifier: string; // Sanitized demo contact e.g. "+91-98765-XXXXX"
  assignedJunctionIds: string[]; // Junctions / signals this officer covers (e.g. ['SIG-01', 'SIG-02'])
  status: OfficerDutyStatus;
  stationName: string;
}

export type AssignmentStatus = 'ASSIGNED' | 'ACKNOWLEDGED' | 'UNASSIGNED';

export interface JunctionAssignment {
  junctionId: string;
  signalId: string;
  officerId: string | null;
  officerName: string | null;
  badgeNumber: string | null;
  contactIdentifier: string | null;
  assignmentReason: string;
  emergencyId: string;
  etaSeconds: number;
  assignedAt: number;
  status: AssignmentStatus;
}

export type AlertStatus = 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'ACKNOWLEDGED' | 'FAILED' | 'DEMO';
export type AlertMode = 'DEMO' | 'LIVE';
export type AlertPriority = 'HIGH' | 'CRITICAL';

export interface EmergencyAlert {
  alertId: string;
  emergencyId: string;
  junctionId: string;
  signalId: string;
  officerId: string;
  officerName: string;
  contactIdentifier: string;
  etaSeconds: number;
  formattedEta: string;
  priority: AlertPriority;
  message: string;
  status: AlertStatus;
  mode: AlertMode;
  timestamp: number;
  acknowledgedAt?: number;
  errorReason?: string;
}

export interface AlertResult {
  success: boolean;
  alertId: string;
  status: AlertStatus;
  mode: AlertMode;
  message: string;
  timestamp: number;
}

export interface AlertService {
  readonly mode: AlertMode;
  sendAlert(alert: EmergencyAlert): Promise<AlertResult>;
  getAlertStatus(alertId: string): Promise<AlertStatus>;
  acknowledgeAlert(alertId: string): Promise<boolean>;
}
