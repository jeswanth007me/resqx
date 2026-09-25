import * as React from 'react';
import { cn } from '../../lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded bg-gray-800/60', className)}
      {...props}
    />
  );
}
