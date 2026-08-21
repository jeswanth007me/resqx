/**
 * ResQX Shared Types — Events
 *
 * Types for the event/audit timeline system.
 */

export type EventSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';

export interface EmergencyEvent {
  id: string;
  timestamp: number;
  type: string;
  description: string;
  severity: EventSeverity;
  relatedSignal?: string;
  relatedUnit?: string;
}
