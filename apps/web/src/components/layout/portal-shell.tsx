import type { ReactNode } from 'react';
import { Bell, Search, LogOut } from 'lucide-react';

import type { NavItem, UserRole } from '@study-assistant/shared-types';
import { Input } from '@study-assistant/ui';

import { LogoMark } from '@/components/layout/logo-mark';
import { SystemBanner } from '@/components/layout/system-banner';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { ProfileDropdown } from '@/components/layout/profile-dropdown';
import { LogoutButton } from '@/features/auth/logout-button';

export function PortalShell({
  title,
  role,
  currentPath,
  navItems,
  systemBanner,
  children,
}: {
  title: string;
  role: UserRole;
  currentPath: string;
  navItems: NavItem[];
  systemBanner?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* ─── Clean Sidebar ─── */}
      <aside className="hidden h-screen w-[260px] shrink-0 flex-col border-r border-border/60 bg-background lg:sticky lg:top-0 lg:flex">
        <div className="flex items-center px-6 py-5">
          <LogoMark href={role === 'admin' || role === 'super_admin' ? '/admin/dashboard' : '/dashboard'} />
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4 py-2">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <SidebarNav items={navItems} currentPath={currentPath} />
          </div>
        </div>

        <div className="border-t border-border/60 p-4">
          <LogoutButton variant="ghost" className="w-full justify-start gap-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-surface">
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </LogoutButton>
        </div>
      </aside>

      {/* ─── Main Content Area ─── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {systemBanner ? <SystemBanner message={systemBanner} tone="warning" /> : null}
        {/* ─── Clean Topbar ─── */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative hidden w-[240px] md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search..." className="h-9 rounded-full bg-surface pl-9 text-sm border-transparent focus:border-accent" />
            </label>
            <ThemeToggle />
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
            </button>
            <div className="border-l border-border/60 h-6 mx-1 hidden md:block" />

            <ProfileDropdown role={role} />
          </div>
        </header>

        {/* ─── Content ─── */}
        <main className="flex-1 p-6 lg:p-8 animate-fade-in">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
