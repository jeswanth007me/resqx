import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'muted';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-red-500/15 text-red-400 border-red-500/30',
    secondary: 'bg-gray-800 text-gray-300 border-gray-700',
    destructive: 'bg-red-950/80 text-red-400 border-red-800/80',
    outline: 'border-gray-700 text-gray-300 bg-transparent',
    success: 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60',
    warning: 'bg-amber-950/50 text-amber-400 border-amber-800/60',
    info: 'bg-sky-950/50 text-sky-400 border-sky-800/60',
    muted: 'bg-gray-900 text-gray-500 border-gray-800',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-semibold border transition-colors select-none tracking-wide uppercase',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
