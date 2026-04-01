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
    <div className="relative mb-8 flex gap-1 overflow-x-auto rounded-xl bg-surface/50 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'relative z-10 whitespace-nowrap rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-200',
            activeTab === tab.id
              ? 'bg-background text-foreground shadow-soft-sm'
              : 'text-muted-foreground hover:bg-background/50 hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
