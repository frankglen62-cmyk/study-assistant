'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

import { sectionReveal } from '@/lib/motion';

/**
 * Generic scroll-triggered reveal wrapper.
 * Uses IntersectionObserver via Framer Motion's whileInView.
 * Supports prefers-reduced-motion automatically.
 */
export function ScrollReveal({
  children,
  className,
  delay = 0,
  amount = 0.18,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  amount?: number;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={sectionReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      transition={delay ? { delay } : undefined}
    >
      {children}
    </motion.div>
  );
}
