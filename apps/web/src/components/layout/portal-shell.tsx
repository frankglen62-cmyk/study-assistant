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
    <div className="flex min-h-screen bg-background text-foreground selection:bg-accent selection:text-black">
      {/* Edge-Anchored Sidebar - Technical Brutalist */}
      <aside className="hidden h-screen w-[280px] shrink-0 flex-col border-r-2 border-border bg-surface lg:sticky lg:top-0 lg:flex">
        <div className="flex items-center px-6 pt-6 pb-6 border-b-2 border-border bg-accent text-black">
          <LogoMark href={role === 'admin' || role === 'super_admin' ? '/admin/dashboard' : '/dashboard'} />
        </div>
        
        <div className="flex min-h-0 flex-1 flex-col px-4 py-6 pattern-grid">
          <div className="border-2 border-border bg-background p-4 shadow-solid-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">Workspace Role</p>
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-bold uppercase tracking-wider">{role.replace('_', ' ')}</p>
              <Badge tone="accent" className="rounded-none border-2 border-border text-[10px] py-0 font-bold uppercase">{role === 'client' ? 'Portal' : 'Admin'}</Badge>
            </div>
          </div>
          
          <div className="mt-8 min-h-0 flex-1 overflow-y-auto pr-1">
            <SidebarNav items={navItems} currentPath={currentPath} />
          </div>
        </div>

        <div className="border-t-2 border-border p-4 bg-surface">
          <LogoutButton variant="secondary" className="w-full justify-start gap-3 rounded-none border-2 border-border shadow-solid-sm font-bold uppercase hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all">
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </LogoutButton>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Full-Width Topbar - Precision Engineered */}
        <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b-2 border-border bg-background px-6">
          <div className="flex items-center gap-4">
            <h1 className="font-display text-2xl font-bold tracking-tight uppercase">{title}</h1>
            <span className="hidden border-2 border-accent bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent sm:inline-block">
              {role === 'client' ? 'Client Area' : 'Admin Area'}
            </span>
          </div>
          
          <div className="flex items-center gap-5">
            <label className="relative hidden w-[280px] md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search system..." className="h-10 rounded-none border-2 border-border bg-surface pl-10 text-sm focus:border-accent focus:ring-0 shadow-solid-sm transition-all" />
            </label>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center border-2 border-border bg-surface text-muted-foreground shadow-solid-sm transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
            </button>
            <div className="border-l-2 border-border h-8 mx-2 hidden md:block"></div>
            <ThemeToggle />
            <ProfileDropdown role={role} />
          </div>
        </header>

        {/* Fluid Content Wrapper */}
        <main className="flex-1 p-6 lg:p-10 animate-fade-in">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
