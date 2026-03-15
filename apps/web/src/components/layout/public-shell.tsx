import Link from 'next/link';
import type { ReactNode } from 'react';

import type { NavItem } from '@study-assistant/shared-types';
import { Button } from '@study-assistant/ui';

import { LogoMark } from '@/components/layout/logo-mark';
import { ThemeToggle } from '@/components/layout/theme-toggle';

export function PublicShell({
  children,
  navItems,
}: {
  children: ReactNode;
  navItems: NavItem[];
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="page-shell">
          <div className="flex h-20 items-center justify-between gap-4">
            <LogoMark />
            <nav className="hidden items-center gap-7 lg:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button asChild variant="secondary" size="sm">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Get Started</Link>
              </Button>
            </div>
          </div>
          <nav className="flex gap-3 overflow-x-auto pb-4 lg:hidden">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href as any}
                className="whitespace-nowrap rounded-full border border-border/70 bg-surface/70 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-border/70 bg-surface/70">
        <div className="page-shell flex flex-col gap-8 py-12 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-lg space-y-3">
            <LogoMark />
            <p className="text-sm text-muted-foreground">
              Secure, subject-aware study assistance for schools, training teams, and private academies.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3 sm:gap-10">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href as any} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
            <Link href="/contact" className="hover:text-foreground">
              Support
            </Link>
            <Link href="/pricing" className="hover:text-foreground">
              Credit Packages
            </Link>
            <Link href="/features" className="hover:text-foreground">
              Subject Routing
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
