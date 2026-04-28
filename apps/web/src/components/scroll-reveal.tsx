'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

import { sectionReveal } from '@/lib/motion';

/**
 * Generic scroll-triggered reveal wrapper.
 * Uses IntersectionObserver via Framer Motion's whileInView.
 * Supports prefers-reduced-motion automatically.
 *
 * Pass `eager` for above-the-fold content so it renders visibly on first paint
 * (no opacity:0 SSR flash). The entrance still animates on mount.
 */
export function ScrollReveal({
  children,
  className,
  delay = 0,
  amount = 0.18,
  eager = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  amount?: number;
  eager?: boolean;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  if (eager) {
    return (
      <motion.div
        className={className}
        variants={sectionReveal}
        initial={false}
        animate="visible"
        transition={delay ? { delay } : undefined}
      >
        {children}
      </motion.div>
    );
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
