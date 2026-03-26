'use client';

import { cn } from '@study-assistant/ui';

export type AccountTab = 'profile' | 'security' | 'devices' | 'extension';

type TabItem = {
  id: AccountTab;
  label: string;
};

export function AccountTabBar({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: TabItem[];
  activeTab: AccountTab;
  onTabChange: (tab: AccountTab) => void;
}) {
  return (
    <div className="relative mb-8 flex gap-1 overflow-x-auto rounded-xl border border-border/50 bg-background/30 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'relative z-10 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
            activeTab === tab.id
              ? 'bg-accent/15 text-accent shadow-sm'
              : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
