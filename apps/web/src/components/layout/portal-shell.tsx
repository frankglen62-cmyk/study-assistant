import type { ReactNode } from 'react';
import { Bell, Search, LogOut } from 'lucide-react';

import type { NavItem, UserRole } from '@study-assistant/shared-types';
import { Badge, Card, Input } from '@study-assistant/ui';

import { LogoMark } from '@/components/layout/logo-mark';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { ProfileDropdown } from '@/components/layout/profile-dropdown';
import { LogoutButton } from '@/features/auth/logout-button';

export function PortalShell({
  title,
  role,
  currentPath,
  navItems,
  children,
}: {
  title: string;
  role: UserRole;
  currentPath: string;
  navItems: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Edge-Anchored Sidebar */}
      <aside className="hidden h-screen w-[260px] shrink-0 flex-col border-r border-border/70 bg-surface/40 lg:sticky lg:top-0 lg:flex">
        <div className="flex items-center px-6 pt-5 pb-4">
          <LogoMark href={role === 'admin' || role === 'super_admin' ? '/admin/dashboard' : '/dashboard'} />
        </div>
        
        <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
          <div className="rounded-[16px] border border-border/70 bg-background/50 p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Workspace Role</p>
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-semibold capitalize">{role.replace('_', ' ')}</p>
              <Badge tone="accent" className="text-[10px] py-0">{role === 'client' ? 'Portal' : 'Admin'}</Badge>
            </div>
          </div>
          
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
            <SidebarNav items={navItems} currentPath={currentPath} />
          </div>
        </div>

        <div className="border-t border-border/70 p-4">
          <LogoutButton variant="secondary" className="w-full justify-start gap-3">
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </LogoutButton>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Full-Width Topbar */}
        <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-border/70 bg-background/80 px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-semibold tracking-tight">{title}</h1>
            <span className="hidden rounded-full bg-accent/10 px-2.5 py-0.5 text-xs text-accent sm:inline-block">
              {role === 'client' ? 'Client Area' : 'Admin Area'}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="relative hidden w-[260px] md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search..." className="h-9 rounded-full bg-surface/50 pl-9 text-sm border-border/50 focus:border-accent" />
            </label>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-surface/50 text-muted-foreground transition hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
            </button>
            <ThemeToggle />
            <ProfileDropdown role={role} />
          </div>
        </header>

        {/* Fluid Content Wrapper */}
        <main className="flex-1 p-6 lg:p-8">
          <div className="mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
