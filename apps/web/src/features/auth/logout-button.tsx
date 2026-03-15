'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/providers/toast-provider';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Button } from '@study-assistant/ui';

import type { ReactNode } from 'react';
import type { ButtonProps } from '@study-assistant/ui';

export function LogoutButton({ 
  children, 
  variant = 'primary',
  className
}: { 
  children?: ReactNode; 
  variant?: ButtonProps['variant'];
  className?: string;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace('/login');
      router.refresh();
    } catch (error) {
      pushToast({
        tone: 'danger',
        title: 'Logout failed',
        description: error instanceof Error ? error.message : 'Unable to end the current session.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button onClick={handleLogout} disabled={pending} variant={variant} className={className}>
      {children || (pending ? 'Logging out...' : 'Logout')}
    </Button>
  );
}
