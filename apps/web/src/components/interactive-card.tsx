'use client';

import type { ReactNode } from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';

import { cn } from '@study-assistant/ui';

export function InteractiveCard({
  children,
  className,
  accent = 'rgba(45, 212, 191, 0.16)',
  borderAccent = 'rgba(125, 211, 252, 0.2)',
  hoverLift = 12,
  hoverScale = 1.05,
}: {

  children: ReactNode;
  className?: string;
  accent?: string;
  borderAccent?: string;
  hoverLift?: number;
  hoverScale?: number;
}) {
  const reduced = useReducedMotion();
  const pointerX = useMotionValue(180);
  const pointerY = useMotionValue(140);
  const rotateXBase = useMotionValue(0);
  const rotateYBase = useMotionValue(0);
  const rotateX = useSpring(rotateXBase, { stiffness: 170, damping: 18, mass: 0.4 });
  const rotateY = useSpring(rotateYBase, { stiffness: 170, damping: 18, mass: 0.4 });

  const glow = useMotionTemplate`radial-gradient(360px circle at ${pointerX}px ${pointerY}px, ${accent}, transparent 62%)`;
  const borderGlow = useMotionTemplate`radial-gradient(420px circle at ${pointerX}px ${pointerY}px, ${borderAccent}, transparent 58%)`;

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const rotateBound = 7;

    pointerX.set(localX);
    pointerY.set(localY);
    rotateXBase.set(((localY / rect.height) - 0.5) * -rotateBound);
    rotateYBase.set(((localX / rect.width) - 0.5) * rotateBound);
  };

  const resetPointer = () => {
    rotateXBase.set(0);
    rotateYBase.set(0);
  };

  return (
    <motion.div
      className={cn(
        'group relative overflow-hidden rounded-[28px] will-change-transform',
        className,
      )}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      style={
        reduced
          ? undefined
          : {
              rotateX,
              rotateY,
              transformPerspective: 1800,
              transformStyle: 'preserve-3d',
            }
      }
      whileHover={
        reduced
          ? undefined
          : {
              y: -hoverLift,
              scale: hoverScale,
              boxShadow: '0 32px 100px rgba(0, 0, 0, 0.45)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            }
      }
      transition={{
        duration: 0.24,
        ease: [0.22, 1, 0.36, 1],
      }}

    >
      {!reduced ? (
        <>
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ backgroundImage: borderGlow }}
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-px rounded-[27px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ backgroundImage: glow }}
          />
        </>
      ) : null}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
