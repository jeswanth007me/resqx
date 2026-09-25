import * as React from 'react';
import { cn } from '../../lib/utils';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'success' | 'warning' | 'info';
}

export function Alert({ className, variant = 'default', ...props }: AlertProps) {
  const variants = {
    default: 'bg-gray-900 border-gray-800 text-gray-200',
    destructive: 'bg-red-950/40 border-red-800/60 text-red-300',
    success: 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300',
    warning: 'bg-amber-950/40 border-amber-800/60 text-amber-300',
    info: 'bg-sky-950/40 border-sky-800/60 text-sky-300',
  };

  return (
    <div
      role="alert"
      className={cn('relative w-full rounded border p-3 font-mono text-xs', variants[variant], className)}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn('mb-1 font-bold leading-none tracking-wide text-gray-100 flex items-center gap-1.5', className)}
      {...props}
    />
  );
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div className={cn('text-[11px] leading-relaxed opacity-90', className)} {...props} />
  );
}
