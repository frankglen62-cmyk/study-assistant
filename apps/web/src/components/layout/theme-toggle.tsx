'use client';

import { useEffect, useState } from 'react';
import { MoonStar, SunMedium } from 'lucide-react';
import { useScopedTheme } from '@/components/providers/scoped-theme-provider';

export function ThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useScopedTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  function handleToggle() {
    // If currently dark, go to light. If currently light, go to dark.
    // If the user's preference is 'system', toggle away from resolved.
    void setTheme(isDark ? 'light' : 'dark');
  }

  return (
    <button
      type="button"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
      onClick={handleToggle}
      aria-label="Toggle theme"
    >
      {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
    </button>
  );
}
