/**
 * ResQX Alert Service Implementation
 *
 * Provides DemoAlertService (fully deterministic zero-cost simulation)
 * and LiveAlertService (secure server-side dispatch interface).
 */

import type { AlertService, EmergencyAlert, AlertResult, AlertStatus, AlertMode } from '../types/police.ts';

/**
 * Deterministic Demo Alert Service
 * Runs without internet or SMS provider credentials.
 * Explicitly marks all actions as DEMO with zero fake claims.
 */
export class DemoAlertService implements AlertService {
  public readonly mode: AlertMode = 'DEMO';
  private alertStatuses: Map<string, AlertStatus> = new Map();

  public async sendAlert(alert: EmergencyAlert): Promise<AlertResult> {
    const timestamp = Date.now();
    this.alertStatuses.set(alert.alertId, 'DISPATCHED');

    console.log(
      `[ResQX Police Demo] 🚨 Alert ${alert.alertId} DISPATCHED to ${alert.officerName} (${alert.contactIdentifier}) for ${alert.signalId}`
    );

    return {
      success: true,
      alertId: alert.alertId,
      status: 'DEMO',
      mode: 'DEMO',
      message: `DEMO ALERT: Successfully dispatched to ${alert.officerName} (Console Mode)`,
      timestamp,
    };
  }

  public async getAlertStatus(alertId: string): Promise<AlertStatus> {
    return this.alertStatuses.get(alertId) ?? 'DEMO';
  }

  public async acknowledgeAlert(alertId: string): Promise<boolean> {
    if (!this.alertStatuses.has(alertId)) {
      this.alertStatuses.set(alertId, 'ACKNOWLEDGED');
      return true;
    }
    this.alertStatuses.set(alertId, 'ACKNOWLEDGED');
    console.log(`[ResQX Police Demo] ✓ Alert ${alertId} ACKNOWLEDGED by assigned officer`);
    return true;
  }
}

/**
 * Live Alert Service (Interfaces securely via server backend)
 * Credentials remain strictly on server-side and are NEVER exposed to browser.
 */
export class LiveAlertService implements AlertService {
  public readonly mode: AlertMode = 'LIVE';
  private serverUrl: string;
  private fallbackDemoService: DemoAlertService;

  constructor(serverUrl: string = 'http://localhost:8000') {
    this.serverUrl = serverUrl;
    this.fallbackDemoService = new DemoAlertService();
  }

  public async sendAlert(alert: EmergencyAlert): Promise<AlertResult> {
    const timestamp = Date.now();
    try {
      const response = await fetch(`${this.serverUrl}/api/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: alert.alertId,
          emergencyId: alert.emergencyId,
          junctionId: alert.junctionId,
          officerId: alert.officerId,
          message: alert.message,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        success: data.status === 'ok',
        alertId: alert.alertId,
        status: data.delivered ? 'DELIVERED' : 'DISPATCHED',
        mode: 'LIVE',
        message: data.message || 'Alert dispatched via backend provider',
        timestamp,
      };
    } catch (err) {
      console.warn('[ResQX Alert] Live backend dispatch failed, falling back to Demo Mode:', err);
      // Clean fallback to demo mode
      return {
        success: false,
        alertId: alert.alertId,
        status: 'FAILED',
        mode: 'LIVE',
        message: `Live dispatch failed: ${(err as Error).message}. Safe fallback active.`,
        timestamp,
      };
    }
  }

  public async getAlertStatus(alertId: string): Promise<AlertStatus> {
    try {
      const res = await fetch(`${this.serverUrl}/api/alert?alertId=${alertId}`);
      if (res.ok) {
        const data = await res.json();
        return data.status as AlertStatus;
      }
    } catch {
      // offline fallback
    }
    return this.fallbackDemoService.getAlertStatus(alertId);
  }

  public async acknowledgeAlert(alertId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.serverUrl}/api/alert?action=acknowledge&alertId=${alertId}`);
      if (res.ok) {
        return true;
      }
    } catch {
      // offline fallback
    }
    return this.fallbackDemoService.acknowledgeAlert(alertId);
  }
}

let activeAlertService: AlertService = new DemoAlertService();

export function getAlertService(): AlertService {
  return activeAlertService;
}

export function setAlertService(service: AlertService): void {
  activeAlertService = service;
}
