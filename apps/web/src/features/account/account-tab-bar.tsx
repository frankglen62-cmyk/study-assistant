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
    <div className="relative mb-8 flex gap-0 overflow-x-auto border-4 border-black bg-surface">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'relative z-10 whitespace-nowrap px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-100 border-r-2 border-black/20 last:border-r-0',
            activeTab === tab.id
              ? 'bg-accent text-black shadow-none'
              : 'text-black/40 hover:bg-black/5 hover:text-black',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
