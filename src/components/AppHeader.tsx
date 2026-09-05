import { useState, useEffect } from 'react';
import { useLocale } from '../i18n/useLocale';
import type { Locale } from '../i18n/strings';
import type { ConnectionStatus } from '../telemetry/useResQXTelemetry';

interface AppHeaderProps {
  activeTab: string;
  simulationTime: number;
  connectionStatus: ConnectionStatus;
  onTabChange?: (tab: string) => void;
}

const navTabs = [
  { key: 'live', label: 'Live Monitor' },
  { key: 'signals', label: 'Signal Control' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'alerts', label: 'Alerts' },
] as const;

const localeLabels: Record<Locale, string> = { en: 'EN', te: 'TL', hi: 'HI' };

export function AppHeader({ activeTab, simulationTime, connectionStatus, onTabChange }: AppHeaderProps) {
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
    <header className="h-14 w-full px-4 sm:px-6 bg-[#111111] border-b border-[#242424] flex items-center justify-between z-50 shrink-0 select-none">
      {/* Brand & System Identifier */}
      <div className="flex items-center gap-3.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#d04848]/15 border border-[#d04848]/40 flex items-center justify-center">
            <span className="font-headline font-bold text-[14px] text-[#d04848] tracking-wider">R</span>
          </div>
          <span className="font-headline font-bold text-[16px] tracking-wider text-[#F5F5F5] uppercase">
            RESQX
          </span>
        </div>

        <div className="h-4 w-px bg-[#262626] hidden sm:block" />

        <span className="font-mono text-[11px] uppercase tracking-widest text-[#737373] hidden md:inline font-medium">
          Emergency Response &amp; Traffic Intelligence
        </span>
      </div>

      {/* Center Nav Segment */}
      <nav className="hidden lg:flex items-center gap-1 bg-[#171717] p-1 rounded border border-[#242424]">
        {navTabs.map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => onTabChange?.(key)}
              className={`px-3 py-1 rounded font-mono text-[11px] transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#262626] text-[#F5F5F5] font-semibold shadow-xs border border-[#333333]'
                  : 'text-[#A3A3A3] hover:text-[#F5F5F5] border border-transparent'
              }`}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {/* Right Telemetry & Status */}
      <div className="flex items-center gap-3 sm:gap-4 font-mono text-[11px]">
        {/* System / SUMO Connection Status */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#171717] border border-[#242424]">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-[#38a169] animate-pulse shadow-[0_0_6px_#38a169]' : 'bg-[#d97706]'
            }`}
          />
          <span
            className={`font-semibold tracking-wider text-[10px] ${
              isConnected ? 'text-[#38a169]' : 'text-[#d97706]'
            }`}
          >
            {isConnected ? 'SUMO / TraCI ONLINE' : 'SIMULATION MODE'}
          </span>
        </div>

        {/* Live UTC Clock */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-[#171717] border border-[#242424] text-[#A3A3A3]">
          <span className="material-symbols-outlined text-[14px] text-[#737373]">schedule</span>
          <span className="text-[#F5F5F5] font-medium tracking-tight text-[11px]">
            {utcTime || '00:00:00 UTC'}
          </span>
          <span className="text-[9px] text-[#737373] ml-1">
            SIM +{Math.round(simulationTime)}s
          </span>
        </div>

        {/* Language selector */}
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="bg-[#171717] text-[#A3A3A3] font-mono text-[11px] border border-[#242424] rounded px-2 py-1 outline-hidden cursor-pointer hover:border-[#383838]"
          title="Language Switcher"
        >
          {Object.entries(localeLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
