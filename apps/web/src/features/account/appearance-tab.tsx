'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';

import { useScopedTheme } from '@/components/providers/scoped-theme-provider';

export function AppearanceTab() {
  const { theme, setTheme } = useScopedTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Theme</h3>
          <p className="text-xs text-muted-foreground mb-5">Choose how the portal looks for you. Changes apply instantly.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl border border-border/40 bg-surface/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const themes = [
    {
      id: 'light',
      label: 'Light',
      description: 'Clean and bright interface',
      icon: Sun,
      preview: {
        bg: 'bg-[hsl(40,20%,98%)]',
        sidebar: 'bg-white',
        header: 'bg-white',
        content: 'bg-[hsl(40,14%,96%)]',
        text: 'bg-[hsl(220,14%,10%)]/20',
        accent: 'bg-[hsl(152,44%,49%)]',
      },
    },
    {
      id: 'dark',
      label: 'Dark',
      description: 'Easy on the eyes',
      icon: Moon,
      preview: {
        bg: 'bg-[hsl(220,16%,8%)]',
        sidebar: 'bg-[hsl(220,14%,11%)]',
        header: 'bg-[hsl(220,14%,11%)]',
        content: 'bg-[hsl(220,12%,16%)]',
        text: 'bg-[hsl(40,10%,92%)]/20',
        accent: 'bg-[hsl(152,44%,49%)]',
      },
    },
    {
      id: 'system',
      label: 'System',
      description: 'Match your device settings',
      icon: Monitor,
      preview: {
        bg: 'bg-gradient-to-br from-[hsl(40,20%,98%)] to-[hsl(220,16%,8%)]',
        sidebar: 'bg-gradient-to-b from-white to-[hsl(220,14%,11%)]',
        header: 'bg-gradient-to-r from-white to-[hsl(220,14%,11%)]',
        content: 'bg-gradient-to-br from-[hsl(40,14%,96%)] to-[hsl(220,12%,16%)]',
        text: 'bg-gray-400/20',
        accent: 'bg-[hsl(152,44%,49%)]',
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Theme</h3>
        <p className="text-xs text-muted-foreground mb-5">Choose how the portal looks for you. Changes apply instantly.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {themes.map((t) => {
          const isSelected = theme === t.id;
          const Icon = t.icon;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id as 'light' | 'dark' | 'system')}
              className={`group relative text-left rounded-2xl border-2 p-1.5 transition-all duration-300 ${
                isSelected
                  ? 'border-accent shadow-soft-md ring-2 ring-accent/20'
                  : 'border-border/40 hover:border-accent/40 hover:shadow-soft-sm'
              }`}
            >
              {/* Mini Preview */}
              <div className={`relative h-32 rounded-xl overflow-hidden ${t.preview.bg}`}>
                {/* Sidebar */}
                <div className={`absolute left-0 top-0 bottom-0 w-[30%] ${t.preview.sidebar} border-r border-white/10`}>
                  <div className="p-2 space-y-1.5 mt-3">
                    {[1, 2, 3, 4].map((i) => {
                      const widthClass = i === 1 ? 'w-[68%]' : i === 2 ? 'w-[76%]' : i === 3 ? 'w-[84%]' : 'w-[92%]';
                      return (
                        <div key={i} className={`h-2 rounded-full ${i === 2 ? t.preview.accent + ' opacity-30' : t.preview.text} ${widthClass}`} />
                      );
                    })}
                  </div>
                </div>
                {/* Main */}
                <div className="absolute left-[30%] right-0 top-0 bottom-0">
                  {/* Header */}
                  <div className={`h-6 ${t.preview.header} border-b border-white/10`} />
                  {/* Content */}
                  <div className="p-2 space-y-2">
                    <div className={`h-3 w-3/4 rounded ${t.preview.text}`} />
                    <div className={`h-8 rounded-lg ${t.preview.content}`} />
                    <div className={`h-8 rounded-lg ${t.preview.content}`} />
                  </div>
                </div>
              </div>

              {/* Label */}
              <div className="p-3 flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                  isSelected ? 'bg-accent/10 text-accent' : 'bg-surface text-muted-foreground group-hover:text-foreground'
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                {isSelected && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border/40 bg-surface/30 p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Note:</strong> Dark mode only applies to the admin and client portal areas. The public website and login pages always use the light theme.
        </p>
      </div>
    </div>
  );
}
