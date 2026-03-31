import * as React from 'react';

import { cn } from '../lib/cn';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[132px] w-full rounded-none border-4 border-black bg-surface px-4 py-3 text-sm font-black uppercase tracking-widest text-black outline-none transition placeholder:text-black/50 focus:border-accent focus:shadow-solid-sm disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
});

Textarea.displayName = 'Textarea';
