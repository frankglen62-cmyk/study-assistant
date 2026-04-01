'use client';

import { useState } from 'react';
import type { Route } from 'next';
import {
  UserCog,
  CreditCard,
  Palette,
  Server,
  Puzzle,
  Monitor,
  LogOut,
} from 'lucide-react';

import { cn, Button } from '@study-assistant/ui';

import { AccountSettingsTab } from '@/features/account/account-settings-tab';
import { AppearanceTab } from '@/features/account/appearance-tab';
import { BillingTab } from '@/features/account/billing-tab';
import { DevicesTab } from '@/features/account/devices-tab';
import { ExtensionTab } from '@/features/account/extension-tab';
import { ClientSettingsForm } from '@/features/client/settings-form';
import { AdminSystemSettingsForm } from '@/features/admin/config-forms';
import { LogoutButton } from '@/features/auth/logout-button';

import type { ClientSettings } from '@study-assistant/shared-types';

type SettingsTab = 'account' | 'billing' | 'preferences' | 'appearance' | 'devices' | 'extension' | 'platform';

type Device = {
  id: string;
  name: string;
  version: string;
  lastSeen: string;
  status: string;
};

type PaymentEntry = {
  id: string;
  date: string;
  package: string;
  provider: string;
  amount: string;
  status: string;
};

type UnifiedSettingsShellProps = {
  variant: 'client' | 'admin';
  profile: {
    fullName: string;
    role: string;
    email: string;
    accountStatus: string;
  };
  security: {
    emailTwoFactorEnabled: boolean;
    mfaEnabled: boolean;
    accountPath: Route;
    emailChangeStatus: 'requested' | 'confirmed' | null;
    pendingEmail: string | null;
  };
  devices?: Device[];
  extensionData?: {
    pairedCount: number;
    latestDevice: { name: string; version: string; lastSeen: string } | null;
  };
  wallet?: { remaining_seconds: number };
  paymentHistory?: PaymentEntry[];
  clientSettings?: ClientSettings;
  defaultTab?: SettingsTab;
};

export function UnifiedSettingsShell({
  variant,
  profile,
  security,
  devices = [],
  extensionData,
  wallet,
  paymentHistory = [],
  clientSettings,
  defaultTab = 'account',
}: UnifiedSettingsShellProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

  const activeDevices = devices.filter((d) => d.status === 'active');

  const clientTabs: { id: SettingsTab; label: string; icon: typeof UserCog }[] = [
    { id: 'account', label: 'Account Settings', icon: UserCog },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'preferences', label: 'Preferences', icon: Server },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'devices', label: 'Devices', icon: Monitor },
    { id: 'extension', label: 'Extension', icon: Puzzle },
  ];

  const adminTabs: { id: SettingsTab; label: string; icon: typeof UserCog }[] = [
    { id: 'account', label: 'Account Settings', icon: UserCog },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'platform', label: 'Platform', icon: Server },
  ];

  const tabs = variant === 'admin' ? adminTabs : clientTabs;

  return (
    <div className="space-y-6">
      {/* Tab Bar */}
      <div className="relative flex gap-1 overflow-x-auto rounded-xl bg-surface/50 p-1 dark:bg-surface/30">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative z-10 flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200',
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-soft-sm'
                  : 'text-muted-foreground hover:bg-background/50 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === 'account' && (
          <AccountSettingsTab
            profile={profile}
            security={security}
            activeDevices={activeDevices}
          />
        )}

        {activeTab === 'billing' && variant === 'client' && wallet && (
          <BillingTab wallet={wallet} paymentHistory={paymentHistory} />
        )}

        {activeTab === 'preferences' && variant === 'client' && clientSettings && (
          <ClientSettingsForm initialSettings={clientSettings} />
        )}

        {activeTab === 'appearance' && (
          <AppearanceTab />
        )}

        {activeTab === 'devices' && variant === 'client' && (
          <DevicesTab devices={devices} />
        )}

        {activeTab === 'extension' && variant === 'client' && extensionData && (
          <ExtensionTab
            pairedCount={extensionData.pairedCount}
            latestDevice={extensionData.latestDevice}
          />
        )}

        {activeTab === 'platform' && variant === 'admin' && (
          <AdminSystemSettingsForm />
        )}
      </div>

      {/* Sign Out Footer */}
      <div className="border-t border-border/40 pt-6">
        <LogoutButton variant="secondary" className="gap-2">
          <LogOut className="h-4 w-4" />
          Sign Out
        </LogoutButton>
      </div>
    </div>
  );
}
