'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { User, Settings, LogOut } from 'lucide-react';

import { useToast } from '@/components/providers/toast-provider';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { cn } from '@study-assistant/ui';
import Link from 'next/link';
import type { UserRole } from '@study-assistant/shared-types';

export function ProfileDropdown({ role }: { role: UserRole }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { pushToast } = useToast();

  const isAdmin = role === 'admin' || role === 'super_admin';
  const settingsHref = isAdmin ? '/admin/settings' : '/settings';
  const accountHref = isAdmin ? '/admin/account' : '/account';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);
    setIsOpen(false);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace('/login');
      router.refresh();
      pushToast({ tone: 'success', title: 'Logged out successfully' });
    } catch (error) {
      pushToast({
        tone: 'danger',
        title: 'Logout failed',
        description: error instanceof Error ? error.message : 'Unable to end the current session.',
      });
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Profile menu"
        disabled={isLoggingOut}
      >
        {isLoggingOut ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-r-transparent" />
        ) : (
          <User className="h-4 w-4" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-52 origin-top-right rounded-2xl border border-border/60 bg-white p-1.5 shadow-soft-lg backdrop-blur z-50 dark:bg-surface animate-fade-in">
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-foreground">My Account</p>
            <p className="text-xs text-muted-foreground capitalize">{role.replace('_', ' ')}</p>
          </div>
          <div className="my-1 h-px bg-border/60" />
          <div className="flex flex-col gap-0.5">
            <Link
              href={accountHref as any}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              <User className="h-4 w-4" />
              Account
            </Link>
            <Link
              href={settingsHref as any}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>
          <div className="my-1 h-px bg-border/60" />
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-danger transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
