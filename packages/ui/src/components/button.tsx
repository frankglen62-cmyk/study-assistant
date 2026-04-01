import * as React from 'react';

import { cn } from '../lib/cn';

const buttonVariants = {
  primary:
    'bg-foreground text-background font-semibold hover:bg-foreground/90 focus-visible:outline-ring shadow-soft-sm hover:shadow-soft-md',
  secondary:
    'bg-background text-foreground font-medium border border-border hover:bg-surface hover:border-border focus-visible:outline-ring shadow-soft-sm',
  ghost:
    'bg-transparent text-foreground font-medium hover:bg-surface focus-visible:outline-ring',
  danger:
    'bg-danger text-white font-semibold hover:bg-danger/90 focus-visible:outline-danger shadow-soft-sm hover:shadow-soft-md',
};

const buttonSizes = {
  sm: 'h-9 px-4 text-sm gap-2',
  md: 'h-11 px-6 text-sm gap-2',
  lg: 'h-12 px-8 text-base gap-2.5',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, children, className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => {
    const buttonClassName = cn(
      'inline-flex items-center justify-center rounded-full transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50',
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
