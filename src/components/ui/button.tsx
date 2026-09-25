import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'success' | 'warning';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => {
    const variants = {
      default: 'bg-red-600 text-white hover:bg-red-500 shadow-sm border border-red-500/50',
      destructive: 'bg-red-950/80 text-red-200 border border-red-800/80 hover:bg-red-900/90',
      outline: 'border border-gray-800 bg-gray-900/60 text-gray-200 hover:bg-gray-800/80 hover:text-white',
      secondary: 'bg-gray-800 text-gray-200 hover:bg-gray-700/80 border border-gray-700/60',
      ghost: 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50 border border-transparent',
      success: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm border border-emerald-500/50',
      warning: 'bg-amber-600/90 text-white hover:bg-amber-500 shadow-sm border border-amber-500/50',
    };

    const sizes = {
      default: 'h-8 px-3.5 py-1.5 text-xs',
      sm: 'h-7 px-2.5 text-[11px]',
      lg: 'h-9 px-4 text-xs font-semibold',
      icon: 'h-8 w-8 p-0 flex items-center justify-center',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded font-mono font-medium transition-colors cursor-pointer select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
