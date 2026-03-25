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
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground transition hover:text-foreground"
        aria-label="Profile menu"
        disabled={isLoggingOut}
      >
        {isLoggingOut ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-r-transparent" />
        ) : (
          <User className="h-5 w-5" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-2xl border border-border/70 bg-surface/95 p-2 shadow-[0_18px_50px_-10px_rgba(8,22,28,0.35)] backdrop-blur animate-in fade-in zoom-in-95 z-50">
          <div className="px-3 py-2">
            <p className="text-sm font-medium">My Account</p>
            <p className="text-xs text-muted-foreground capitalize">{role.replace('_', ' ')}</p>
          </div>
          <div className="my-1 h-px bg-border/70" />
          <div className="flex flex-col gap-1">
            <Link
              href={accountHref as any}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
            >
              <User className="h-4 w-4" />
              Account
            </Link>
            <Link
              href={settingsHref as any}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>
          <div className="my-1 h-px bg-border/70" />
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-accent transition hover:bg-accent/10"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
