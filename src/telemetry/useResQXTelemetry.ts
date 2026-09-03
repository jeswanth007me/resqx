/**
 * ResQX Unified Telemetry & Control Hook
 *
 * Connects to live Eclipse SUMO bridge via HTTP with automatic failover
 * to deterministic Local Simulation Engine when SUMO is offline.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TelemetryData } from '../types/telemetry.ts';
import { initialState, tick, simulationStateToTelemetry } from '../simulation/engine.ts';
import type { SimulationState, SignalState } from '../types/simulation.ts';

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';

export interface UseResQXTelemetryResult {
  telemetry: TelemetryData | null;
  connectionStatus: ConnectionStatus;
  error: string | null;
  sendControl: (action: 'start' | 'pause' | 'reset' | 'speed', value?: number) => Promise<void>;
  overrideSignal: (signalId: string, phase: string, pattern?: string) => void;
}

const SERVER_URL = 'http://localhost:8000';
const MAX_CONSECUTIVE_FAILURES = 2;

export function useResQXTelemetry(): UseResQXTelemetryResult {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(() => simulationStateToTelemetry(initialState()));
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CONNECTING');
  const [error, setError] = useState<string | null>(null);

  const localStateRef = useRef<SimulationState>(initialState());
  const consecutiveFailuresRef = useRef<number>(0);
  const hasInitialPageLoadCheckedRef = useRef<boolean>(false);

  const overrideSignal = useCallback((signalId: string, phase: string, _pattern?: string) => {
    let signalState: SignalState = 'NORMAL';
    const p = phase.toUpperCase();
    if (p === 'PRIORITY' || p === 'PASSING' || p === 'EMERGENCY_PRIORITY' || p === 'EMERGENCY PRIORITY') {
      signalState = 'EMERGENCY_PRIORITY';
    } else if (p === 'PREPARING' || p === 'GREEN') {
      signalState = 'GREEN';
    } else if (p === 'RED') {
      signalState = 'RED';
    } else if (p === 'RESTORING' || p === 'RESTORED' || p === 'NORMAL') {
      signalState = 'NORMAL';
    }

    localStateRef.current = {
      ...localStateRef.current,
      signals: localStateRef.current.signals.map((s) =>
        s.id === signalId ? { ...s, state: signalState } : s
      ),
    };

    if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
      setTelemetry(simulationStateToTelemetry(localStateRef.current));
    }
  }, []);

  const sendControl = useCallback(async (action: 'start' | 'pause' | 'reset' | 'speed', value?: number) => {
    // 1. Immediately update local simulation engine state for zero-lag responsiveness
    if (action === 'start') {
      localStateRef.current = { ...localStateRef.current, isRunning: true };
      setTelemetry((prev) =>
        prev
          ? { ...prev, simulation: { ...prev.simulation, running: true } }
          : simulationStateToTelemetry(localStateRef.current)
      );
    } else if (action === 'pause') {
      localStateRef.current = { ...localStateRef.current, isRunning: false };
      setTelemetry((prev) =>
        prev
          ? { ...prev, simulation: { ...prev.simulation, running: false } }
          : simulationStateToTelemetry(localStateRef.current)
      );
    } else if (action === 'reset') {
      localStateRef.current = initialState();
      setTelemetry(simulationStateToTelemetry(initialState()));
    } else if (action === 'speed' && value) {
      localStateRef.current = { ...localStateRef.current, speed: value as 1 | 2 | 5 };
      setTelemetry((prev) =>
        prev
          ? { ...prev, simulation: { ...prev.simulation, speed: value } }
          : simulationStateToTelemetry(localStateRef.current)
      );
    }

    // 2. Dispatch control command to SUMO backend bridge if available
    try {
      const url = value !== undefined
        ? `${SERVER_URL}/api/control?action=${action}&value=${value}`
        : `${SERVER_URL}/api/control?action=${action}`;
      await fetch(url, { method: 'GET', cache: 'no-store' });
    } catch {
      // Offline fallback handling
    }
  }, []);

  // Poll HTTP telemetry endpoint with auto-reconnect resilience
  useEffect(() => {
    let isMounted = true;
    let timer: number | null = null;

    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/telemetry`, {
          cache: 'no-store',
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let data: TelemetryData = await res.json();

        if (isMounted) {
          consecutiveFailuresRef.current = 0;

          if (!hasInitialPageLoadCheckedRef.current) {
            hasInitialPageLoadCheckedRef.current = true;

            if (data.simulation.running === false && data.ambulance.status === 'ARRIVED') {
              await sendControl('reset');
              try {
                const freshRes = await fetch(`${SERVER_URL}/api/telemetry`, { cache: 'no-store' });
                if (freshRes.ok) data = await freshRes.json();
              } catch {
                // keep default
              }
            }
          }

          setTelemetry(data);
          setConnectionStatus('CONNECTED');
          setError(null);
        }
      } catch {
        if (isMounted) {
          consecutiveFailuresRef.current += 1;

          if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
            setConnectionStatus('DISCONNECTED');
            setError(null);

            // Step local simulation if running
            if (localStateRef.current.isRunning) {
              localStateRef.current = tick(localStateRef.current, 0.15);
            }
            setTelemetry(simulationStateToTelemetry(localStateRef.current));
          } else {
            setConnectionStatus((prev) => (prev === 'CONNECTED' ? 'CONNECTING' : prev));
          }
        }
      } finally {
        if (isMounted) {
          const pollInterval = consecutiveFailuresRef.current === 0 ? 150 : 150;
          timer = window.setTimeout(fetchTelemetry, pollInterval);
        }
      }
    };

    fetchTelemetry();

    return () => {
      isMounted = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [sendControl]);

  return {
    telemetry,
    connectionStatus,
    error,
    sendControl,
    overrideSignal,
  };
}
