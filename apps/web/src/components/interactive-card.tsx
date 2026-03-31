'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@study-assistant/ui';

export function InteractiveCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={cn(
        'group relative overflow-hidden rounded-2xl',
        className,
      )}
      whileHover={
        reduced
          ? undefined
          : {
              y: -4,
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04)',
            }
      }
      transition={{
        duration: 0.25,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
