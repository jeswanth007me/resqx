import { useState, useEffect, useCallback, useRef } from 'react';
import type { TelemetryData } from '../types/telemetry';

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';

export interface UseResQXTelemetryResult {
  telemetry: TelemetryData | null;
  connectionStatus: ConnectionStatus;
  error: string | null;
  sendControl: (action: 'start' | 'pause' | 'reset' | 'speed', value?: number) => Promise<void>;
}

const SERVER_URL = 'http://localhost:8000';
const MAX_CONSECUTIVE_FAILURES = 3;

export function useResQXTelemetry(): UseResQXTelemetryResult {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CONNECTING');
  const [error, setError] = useState<string | null>(null);

  const consecutiveFailuresRef = useRef<number>(0);
  const hasInitialPageLoadCheckedRef = useRef<boolean>(false);

  const sendControl = useCallback(async (action: 'start' | 'pause' | 'reset' | 'speed', value?: number) => {
    try {
      const url = value !== undefined
        ? `${SERVER_URL}/api/control?action=${action}&value=${value}`
        : `${SERVER_URL}/api/control?action=${action}`;
      await fetch(url, { method: 'GET', cache: 'no-store' });
    } catch (err) {
      console.error(`[ResQX] Failed to send control action ${action}:`, err);
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

          // ── INITIAL PAGE LOAD / BROWSER REFRESH RECOVERY CHECK ──
          // Executes ONLY ONCE on the very first successful telemetry connection of a fresh page mount
          if (!hasInitialPageLoadCheckedRef.current) {
            hasInitialPageLoadCheckedRef.current = true;

            // If browser refreshed AFTER a completed mission (simulation.running === false & status === "ARRIVED"),
            // issue ONE real server reset to restore READY/STAGED state for the new browser session.
            if (data.simulation.running === false && data.ambulance.status === 'ARRIVED') {
              console.log('[ResQX] Browser refresh detected after completed mission. Issuing ONE server reset...');
              await sendControl('reset');

              // Fetch fresh post-reset telemetry
              try {
                const freshRes = await fetch(`${SERVER_URL}/api/telemetry`, { cache: 'no-store' });
                if (freshRes.ok) {
                  data = await freshRes.json();
                }
              } catch (e) {
                // Keep default data if fetch fails
              }
            }
          }

          setTelemetry(data);
          setConnectionStatus('CONNECTED');
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          consecutiveFailuresRef.current += 1;

          if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
            setTelemetry(null);
            setConnectionStatus('DISCONNECTED');
            setError('SUMO Telemetry Server disconnected. Run python telemetry_server.py');
          } else {
            setConnectionStatus((prev) => (prev === 'CONNECTED' ? 'CONNECTING' : prev));
          }
        }
      } finally {
        if (isMounted) {
          const pollInterval = consecutiveFailuresRef.current === 0 ? 150 : 500;
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
  };
}
