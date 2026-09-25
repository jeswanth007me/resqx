import { useState, useEffect } from 'react';
import { Ambulance, Play, Pause, RefreshCw, Wifi, WifiOff, Clock } from 'lucide-react';
import { useLocale } from '../i18n/useLocale';
import type { Locale } from '../i18n/strings';
import type { ConnectionStatus } from '../telemetry/useResQXTelemetry';
import { Button } from './ui/button';

interface AppHeaderProps {
  activeTab: string;
  simulationTime: number;
  connectionStatus: ConnectionStatus;
  onTabChange?: (tab: string) => void;
  isRunning?: boolean;
  onStart?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  speed?: 1 | 2 | 5;
  onSpeedChange?: (speed: 1 | 2 | 5) => void;
}

const navTabs = [
  { key: 'live', label: 'Live Monitor' },
  { key: 'signals', label: 'Signal Control' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'alerts', label: 'Alerts' },
] as const;

const localeLabels: Record<Locale, string> = { en: 'EN', te: 'TL', hi: 'HI' };

export function AppHeader({
  activeTab,
  simulationTime,
  connectionStatus,
  onTabChange,
  isRunning = false,
  onStart,
  onPause,
  onReset,
  speed = 1,
  onSpeedChange,
}: AppHeaderProps) {
  const { locale, setLocale } = useLocale();
  const isConnected = connectionStatus === 'CONNECTED';
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${h}:${m}:${s} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 w-full px-3 sm:px-5 bg-gray-950/95 border-b border-gray-800 flex items-center justify-between z-50 shrink-0 select-none backdrop-blur-md">
      {/* ── LEFT: ResQX Branding & Emergency Corridor Management ── */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-red-600/15 border border-red-500/40 flex items-center justify-center shadow-xs">
            <Ambulance className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex flex-col">
            <span className="font-headline font-bold text-sm tracking-wider text-gray-100 uppercase leading-none">
              ResQX
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-gray-400 mt-0.5">
              Emergency Corridor Management
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-gray-800 hidden md:block" />

        {/* View Switcher Tabs */}
        <nav className="hidden lg:flex items-center gap-1 bg-gray-900/90 p-1 rounded border border-gray-800">
          {navTabs.map(({ key, label }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => onTabChange?.(key)}
                className={`px-3 py-1 rounded font-mono text-[11px] transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-gray-800 text-gray-100 font-semibold shadow-xs border border-gray-700'
                    : 'text-gray-400 hover:text-gray-200 border border-transparent'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── CENTER / STATUS: SUMO CONNECTED or LOCAL SIMULATION ── */}
      <div className="hidden md:flex items-center gap-2 font-mono">
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded border text-xs font-bold tracking-wider ${
            isConnected
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400'
              : 'bg-amber-950/30 border-amber-800/50 text-amber-400'
          }`}
        >
          {isConnected ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span>{isConnected ? 'SUMO CONNECTED' : 'LOCAL SIMULATION'}</span>
        </div>

        {/* Clock & Mission Time */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-gray-900/80 border border-gray-800 text-gray-400 text-[11px]">
          <Clock className="w-3 h-3 text-gray-500" />
          <span className="text-gray-300 font-medium">{utcTime || '00:00:00 UTC'}</span>
          <span className="text-[9px] text-gray-500 ml-1">+{Math.round(simulationTime)}s</span>
        </div>
      </div>

      {/* ── RIGHT: START / PAUSE / RESET ACTIONS ── */}
      <div className="flex items-center gap-2 font-mono">
        {onStart && onPause && (
          <Button
            size="sm"
            onClick={isRunning ? onPause : onStart}
            className={`h-8 px-3 text-xs font-bold tracking-wide transition-all ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-sm'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>START</span>
              </>
            )}
          </Button>
        )}

        {onReset && (
          <Button
            size="sm"
            variant="outline"
            onClick={onReset}
            className="h-8 px-2.5 text-xs text-gray-300 hover:text-white border-gray-800 bg-gray-900 hover:bg-gray-800"
            title="Reset Corridor Simulation"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">RESET</span>
          </Button>
        )}

        {/* Speed selector */}
        {onSpeedChange && (
          <div className="hidden sm:flex items-center gap-1 bg-gray-900/90 p-1 rounded border border-gray-800 text-[10px]">
            <span className="text-gray-500 px-1 font-bold">SPD:</span>
            {([1, 2, 5] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSpeedChange(s)}
                className={`px-1.5 py-0.5 rounded font-mono font-bold transition-colors cursor-pointer ${
                  speed === s
                    ? 'bg-gray-800 text-gray-100 border border-gray-700'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        )}

        {/* Language selector */}
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="bg-gray-900 text-gray-300 font-mono text-[11px] border border-gray-800 rounded px-2 py-1 outline-none cursor-pointer hover:border-gray-700 h-8"
          title="Language Switcher"
        >
          {Object.entries(localeLabels).map(([key, label]) => (
            <option key={key} value={key} className="bg-gray-900 text-gray-200">
              {label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}

