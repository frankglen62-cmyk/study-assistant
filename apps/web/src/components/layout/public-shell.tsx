'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import type { NavItem } from '@study-assistant/shared-types';
import { cn } from '@study-assistant/ui';

import { LogoMark } from '@/components/layout/logo-mark';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import {
  navReveal,
  navItemStagger,
  navItem,
  footerReveal,
  footerStagger,
  pageStage,
} from '@/lib/motion';

const footerColumns = [
  {
    title: 'Study Assistant',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Product',
    links: [
      { label: 'Extension Guide', href: '/extension-guide' },
      { label: 'Subject Routing', href: '/features' },
      { label: 'Credit Packages', href: '/pricing' },
      { label: 'AI Retrieval', href: '/features' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Help Center', href: '/contact' },
      { label: 'FAQ', href: '/#faq' },
      { label: 'How It Works', href: '/#how-it-works' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
];

export function PublicShell({
  children,
  navItems,
}: {
  children: ReactNode;
  navItems: NavItem[];
}) {
  const reduced = useReducedMotion();
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── Clean Premium Navbar ─── */}
      <motion.header
        className="sticky top-0 z-50 border-b border-border/40 bg-white/80 backdrop-blur-xl dark:bg-background/80"
        variants={navReveal}
        initial={reduced ? undefined : 'hidden'}
        animate={reduced ? undefined : 'visible'}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <motion.div variants={navItem}>
            <LogoMark />
          </motion.div>

          <motion.nav
            className="hidden items-center gap-1 lg:flex"
            variants={navItemStagger}
            initial={reduced ? undefined : 'hidden'}
            animate={reduced ? undefined : 'visible'}
          >
            {navItems.map((item) => (
              <motion.div key={item.href} variants={navItem}>
                <Link
                  href={item.href as any}
                  prefetch
                  className={cn(
                    'relative rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200',
                    isActive(item.href)
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {isActive(item.href) ? (
                    <motion.span
                      layoutId="public-nav-indicator-desktop"
                      className="absolute inset-0 rounded-full bg-surface"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  ) : null}
                  <span className="relative z-10">{item.label}</span>
                </Link>
              </motion.div>
            ))}
          </motion.nav>

          <motion.div
            className="flex items-center gap-3"
            variants={navItemStagger}
            initial={reduced ? undefined : 'hidden'}
            animate={reduced ? undefined : 'visible'}
          >
            <motion.div variants={navItem}>
              <ThemeToggle />
            </motion.div>
            <motion.div variants={navItem}>
              <Link
                href="/login"
                prefetch
                className="hidden rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              >
                Sign In
              </Link>
            </motion.div>
            <motion.div variants={navItem}>
              <Link
                href="/register"
                prefetch
                className="inline-flex items-center rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background shadow-soft-sm transition-all duration-200 hover:bg-foreground/90 hover:shadow-soft-md"
              >
                Get Started
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* Mobile nav */}
        <nav className="flex gap-2 overflow-x-auto px-6 pb-3 lg:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href as any}
              prefetch
              className={cn(
                'relative whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-surface text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </motion.header>

      <main className="relative">
        <AnimatePresence initial={!reduced} mode="wait">
          <motion.div
            key={pathname}
            variants={pageStage}
            initial={reduced ? undefined : 'hidden'}
            animate={reduced ? undefined : 'visible'}
            exit={reduced ? undefined : 'exit'}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ─── Clean Footer ─── */}
      <motion.footer
        className="border-t border-border/40 bg-surface/50"
        variants={footerReveal}
        initial={reduced ? undefined : 'hidden'}
        whileInView={reduced ? undefined : 'visible'}
        viewport={{ once: true, amount: 0.1 }}
      >
        <div className="mx-auto max-w-7xl px-6 py-16">
          <motion.div
            className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5"
            variants={footerStagger}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.1 }}
          >
            <motion.div variants={footerReveal} className="lg:col-span-1">
              <LogoMark />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Secure, subject-aware study assistance for schools, training teams, and private
                academies.
              </p>
            </motion.div>

            {footerColumns.map((col) => (
              <motion.div key={col.title} variants={footerReveal}>
                <h3 className="mb-4 text-sm font-semibold text-foreground">{col.title}</h3>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href as any}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/40 pt-8 sm:flex-row"
            variants={footerReveal}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.1 }}
          >
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Study Assistant. All Rights Reserved.
            </p>
          </motion.div>
        </div>
      </motion.footer>
    </div>
  );
}
