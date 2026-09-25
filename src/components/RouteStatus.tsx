import { Navigation, Ambulance } from 'lucide-react';

interface RouteStatusProps {
  name: string;
  distance: string;
  estimatedTime: string;
  signals: number;
  status: string;
}

export function RouteStatus({ name, distance, estimatedTime, signals, status }: RouteStatusProps) {
  return (
    <div className="p-4 border-b border-gray-800 font-mono">
      <div className="flex items-center gap-2 mb-3">
        <Navigation className="w-4 h-4 text-emerald-400" />
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Active Route
        </h3>
      </div>

      <div className="bg-gray-950 p-4 rounded border-l-2 border-emerald-500 border border-gray-800">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-sm font-medium text-gray-100">{name}</div>
            <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mt-1">
              {status}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-medium text-gray-100">{estimatedTime}</div>
            <div className="text-[10px] font-semibold text-gray-500">{distance}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-[2px] bg-emerald-500 rounded-full" />
          <Ambulance className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div className="flex-1 h-[2px] bg-emerald-500 rounded-full" />
        </div>

        <div className="flex justify-between mt-2">
          <span className="text-[10px] font-semibold text-gray-400 uppercase">
            {signals} signals on route
          </span>
        </div>
      </div>
    </div>
  );
}
