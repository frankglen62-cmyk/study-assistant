import type { Variants, Transition } from 'framer-motion';

/* ═══════════════════════════════════════════
   Premium easing curves
   ═══════════════════════════════════════════ */

export const ease = {
  /** Smooth deceleration — primary reveal easing */
  out: [0.22, 1, 0.36, 1] as [number, number, number, number],
  /** Snappy deceleration — buttons and micro interactions */
  snap: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

/* ═══════════════════════════════════════════
   Shared transition presets
   ═══════════════════════════════════════════ */

export const t = {
  fast: { duration: 0.5, ease: ease.out } satisfies Transition,
  normal: { duration: 0.65, ease: ease.out } satisfies Transition,
  slow: { duration: 0.75, ease: ease.out } satisfies Transition,
  hover: { duration: 0.2, ease: ease.snap } satisfies Transition,
};

/* ═══════════════════════════════════════════
   Navbar
   ═══════════════════════════════════════════ */

export const navReveal: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: ease.out } },
};

export const navItemStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

export const navItem: Variants = {
  hidden: { opacity: 0, y: -6 },
  visible: { opacity: 1, y: 0, transition: t.fast },
};

/* ═══════════════════════════════════════════
   Hero sequence
   ═══════════════════════════════════════════ */

export const heroContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } },
};

export const heroBadgeReveal: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: ease.out } },
};

export const heroHeadlineReveal: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: ease.out } },
};

export const heroTextReveal: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: ease.out } },
};

export const heroCtaContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.16, delayChildren: 0.8 } },
};

export const heroCtaPrimaryReveal: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    width: 48,
    height: 4,
  },
  visible: {
    opacity: 1,
    scale: 1,
    width: 'auto',
    height: 'auto',
    transition: {
      duration: 0.22,
      ease: ease.out,
      opacity: { duration: 0.18, delay: 0.08 },
    },
  },
};

export const heroCtaSecondaryReveal: Variants = {
  hidden: { opacity: 0, x: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.18, ease: ease.out },
  },
};


export const heroPanelReveal: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.8, ease: ease.out, delay: 0.15 },
  },
};

export const heroPanelItemStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.2 } },
};

export const heroPanelItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: ease.out } },
};

export const pageStage: Variants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(18px)', scale: 0.992 },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    scale: 1,
    transition: { duration: 0.58, ease: ease.out },
  },
  exit: {
    opacity: 0,
    y: -18,
    filter: 'blur(12px)',
    scale: 0.995,
    transition: { duration: 0.28, ease: ease.snap },
  },
};

/* ═══════════════════════════════════════════
   Trust / platform strip
   ═══════════════════════════════════════════ */

export const trustStripReveal: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: ease.out } },
};

export const trustItemStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

/* ═══════════════════════════════════════════
   Section reveals (scroll-triggered)
   ═══════════════════════════════════════════ */

export const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: t.normal },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: t.normal },
};

/* ═══════════════════════════════════════════
   Cards & hover
   ═══════════════════════════════════════════ */

export const cardHover = {
  y: -3,
  transition: t.hover,
};

export const cardTap = {
  y: -1,
  transition: t.hover,
};

export const pricingCardHover = {
  y: -14,
  scale: 1.025,
  transition: { type: 'spring', stiffness: 230, damping: 22, mass: 0.7 },
};

/* ═══════════════════════════════════════════
   Buttons
   ═══════════════════════════════════════════ */

export const buttonHover = {
  y: -2,
  boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
  transition: t.hover,
};

export const buttonTap = {
  y: 0,
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  transition: t.hover,
};

/* ═══════════════════════════════════════════
   FAQ accordion
   ═══════════════════════════════════════════ */

export const faqExpandMotion: Variants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: { height: { duration: 0.28, ease: ease.out }, opacity: { duration: 0.22, delay: 0.06 } },
  },
};

export const faqChevronMotion: Variants = {
  collapsed: { rotate: 0 },
  expanded: { rotate: 45 },
};

/* ═══════════════════════════════════════════
   Footer
   ═══════════════════════════════════════════ */

export const footerReveal: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: t.fast },
};

export const footerStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
