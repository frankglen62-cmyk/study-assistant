import * as React from 'react';

import { cn } from '../lib/cn';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-12 w-full rounded-none border-4 border-black bg-surface px-4 py-2 text-sm font-black uppercase tracking-widest text-black outline-none transition placeholder:text-black/50 focus:border-accent focus:shadow-solid-sm disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
