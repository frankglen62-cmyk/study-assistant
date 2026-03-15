import * as React from 'react';

import { cn } from '../lib/cn';

const buttonVariants = {
  primary:
    'bg-accent text-accent-foreground shadow-glow hover:bg-accent/90 focus-visible:outline-accent',
  secondary:
    'bg-surface text-surface-foreground border border-border hover:bg-surface/80 focus-visible:outline-border',
  ghost:
    'bg-transparent text-foreground hover:bg-muted/70 focus-visible:outline-border',
  danger:
    'bg-danger text-danger-foreground hover:bg-danger/90 focus-visible:outline-danger',
};

const buttonSizes = {
  md: 'h-11 px-4 text-sm',
  sm: 'h-9 px-3 text-sm',
  lg: 'h-12 px-5 text-base',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, children, className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => {
    const buttonClassName = cn(
      'inline-flex items-center justify-center gap-2 rounded-full font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
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
