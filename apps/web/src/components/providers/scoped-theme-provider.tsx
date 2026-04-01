'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

type AppearanceMode = 'light' | 'dark' | 'system';

interface ScopedThemeContextType {
  theme: AppearanceMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: AppearanceMode) => Promise<void>;
}

const ScopedThemeContext = createContext<ScopedThemeContextType | undefined>(undefined);

export function useScopedTheme() {
  const context = useContext(ScopedThemeContext);
  if (!context) {
    throw new Error('useScopedTheme must be used within a ScopedThemeProvider');
  }
  return context;
}

interface ScopedThemeProviderProps {
  initialTheme: AppearanceMode;
  children: React.ReactNode;
}

export function ScopedThemeProvider({ initialTheme, children }: ScopedThemeProviderProps) {
  const [theme, setThemeState] = useState<AppearanceMode>(initialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (initialTheme === 'system') {
      // Best guess for SSR to avoid hydration mismatch if possible, but actually 
      // we can't know OS preference on the server reliably without client hints.
      // We will default to light for SSR of system preference, and update on mount.
      return 'light'; 
    }
    return initialTheme;
  });

  // Watch for system preference changes when in 'system' mode
  useEffect(() => {
    const handleSystemChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (theme === 'system') {
        setResolvedTheme(e.matches ? 'dark' : 'light');
      }
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Initial check
    handleSystemChange(mediaQuery);

    // Listen for changes
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme]);

  const setTheme = async (newTheme: AppearanceMode) => {
    // Optimistic UI update
    setThemeState(newTheme);
    if (newTheme !== 'system') {
      setResolvedTheme(newTheme);
    } else {
      setResolvedTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }

    // Persist to backend
    try {
      const res = await fetch('/api/me/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ appearanceMode: newTheme }),
      });
      if (!res.ok) {
        console.error('Failed to save appearance mode');
      }
    } catch (err) {
      console.error('Error saving appearance mode', err);
    }
  };

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme]);

  return (
    <ScopedThemeContext.Provider value={value}>
      <div className={`${resolvedTheme} min-h-screen bg-background text-foreground transition-colors duration-200`}>
        {children}
      </div>
    </ScopedThemeContext.Provider>
  );
}
