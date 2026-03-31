import * as React from 'react';

import { cn } from '../lib/cn';

const buttonVariants = {
  primary:
    'bg-accent text-black font-black uppercase hover:bg-black hover:text-white border-2 border-black focus-visible:outline-accent shadow-solid-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none',
  secondary:
    'bg-surface text-foreground font-black uppercase border-2 border-border hover:bg-foreground hover:text-background focus-visible:outline-border shadow-solid-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none',
  ghost:
    'bg-transparent text-foreground font-black uppercase hover:bg-surface border-2 border-transparent hover:border-border hover:shadow-solid-sm focus-visible:outline-border',
  danger:
    'bg-danger text-white font-black uppercase border-2 border-danger hover:bg-white hover:text-danger focus-visible:outline-danger shadow-solid-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none',
};

const buttonSizes = {
  md: 'h-12 px-6 text-sm tracking-widest',
  sm: 'h-10 px-4 text-xs tracking-widest',
  lg: 'h-14 px-8 text-base tracking-widest',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, children, className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => {
    const buttonClassName = cn(
      'inline-flex items-center justify-center gap-3 rounded-none transition-all disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-solid-sm',
      buttonVariants[variant],
      buttonSizes[size],
      className,
    );

    if (asChild && React.isValidElement(children)) {
      const child = React.Children.only(children) as React.ReactElement<{ className?: string }>;

      return React.cloneElement(child, {
        className: cn(buttonClassName, child.props.className),
      });
    }

    return (
      <button
        ref={ref}
        type={type}
        className={buttonClassName}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
