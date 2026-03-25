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
  buttonHover,
  buttonTap,
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
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <motion.header
        className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/82 backdrop-blur-xl"
        variants={navReveal}
        initial={reduced ? undefined : 'hidden'}
        animate={reduced ? undefined : 'visible'}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <motion.div variants={navItem}>
            <LogoMark />
          </motion.div>

          <motion.nav
            className="hidden items-center gap-2 lg:flex"
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
                    'group relative inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300',
                    isActive(item.href)
                      ? 'text-white'
                      : 'text-neutral-400 hover:text-white',
                  )}
                >
                  {isActive(item.href) ? (
                    <motion.span
                      layoutId="public-nav-indicator-desktop"
                      className="absolute inset-0 rounded-full border border-white/[0.08] bg-white/[0.05] shadow-[0_0_34px_rgba(45,212,191,0.08)]"
                      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                    />
                  ) : null}
                  <span className="relative z-10">{item.label}</span>
                  <span className="pointer-events-none absolute inset-x-4 bottom-1 h-px origin-left scale-x-0 bg-gradient-to-r from-transparent via-teal-300/80 to-transparent opacity-0 transition duration-300 group-hover:scale-x-100 group-hover:opacity-100" />
                  {isActive(item.href) ? (
                    <motion.span
                      layoutId="public-nav-line-desktop"
                      className="pointer-events-none absolute inset-x-4 bottom-1 h-px bg-gradient-to-r from-transparent via-teal-300 to-transparent"
                    />
                  ) : null}
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
                className="hidden rounded-lg px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:text-white sm:inline-flex"
              >
                Sign In
              </Link>
            </motion.div>
            <motion.div
              variants={navItem}
              whileHover={reduced ? undefined : buttonHover}
              whileTap={reduced ? undefined : buttonTap}
            >
              <Link
                href="/register"
                prefetch
                className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-black/20 transition-colors hover:bg-neutral-100"
              >
                Get Started
              </Link>
            </motion.div>
          </motion.div>
        </div>

        <nav className="flex gap-3 overflow-x-auto px-6 pb-3 lg:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href as any}
              prefetch
              className={cn(
                'relative whitespace-nowrap rounded-full border px-4 py-2 text-sm transition-colors',
                isActive(item.href)
                  ? 'border-white/15 bg-white/[0.05] text-white'
                  : 'border-white/10 text-neutral-400 hover:text-white',
              )}
            >
              {isActive(item.href) ? (
                <motion.span
                  layoutId="public-nav-indicator-mobile"
                  className="absolute inset-0 rounded-full border border-white/[0.08] bg-white/[0.04]"
                />
              ) : null}
              <span className="relative z-10">{item.label}</span>
            </Link>
          ))}
        </nav>
      </motion.header>

      <main className="relative">
        <AnimatePresence initial={false} mode="wait">
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

      <motion.footer
        className="border-t border-white/[0.06] bg-[#111111]"
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
              <p className="mt-4 text-sm leading-relaxed text-neutral-500">
                Secure, subject-aware study assistance for schools, training teams, and private
                academies.
              </p>
              <div className="mt-6 flex gap-4">
                <a
                  href="#"
                  className="text-neutral-500 transition-colors hover:text-white"
                  aria-label="Twitter / X"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="text-neutral-500 transition-colors hover:text-white"
                  aria-label="Facebook"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="text-neutral-500 transition-colors hover:text-white"
                  aria-label="Instagram"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C16.67.014 16.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                </a>
              </div>
            </motion.div>

            {footerColumns.map((col) => (
              <motion.div key={col.title} variants={footerReveal}>
                <h3 className="mb-4 text-sm font-semibold text-white">{col.title}</h3>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href as any}
                        className="text-sm text-neutral-500 transition-colors hover:text-white"
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
            className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-8 sm:flex-row"
            variants={footerReveal}
            initial={reduced ? undefined : 'hidden'}
            whileInView={reduced ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.1 }}
          >
            <p className="text-sm text-neutral-600">
              © {new Date().getFullYear()} Study Assistant. All Rights Reserved.
            </p>
          </motion.div>
        </div>
      </motion.footer>
    </div>
  );
}
