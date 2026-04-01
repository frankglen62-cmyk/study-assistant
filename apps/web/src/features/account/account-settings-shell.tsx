'use client';

import { useState } from 'react';
import type { Route } from 'next';

import { AccountTabBar, type AccountTab } from '@/features/account/account-tab-bar';
import { ProfileTab } from '@/features/account/profile-tab';
import { SecurityTab } from '@/features/account/security-tab';
import { DevicesTab } from '@/features/account/devices-tab';
import { ExtensionTab } from '@/features/account/extension-tab';

type Device = {
  id: string;
  name: string;
  version: string;
  lastSeen: string;
  status: string;
};

type AccountSettingsShellProps = {
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
  defaultTab?: AccountTab;
};

export function AccountSettingsShell({
  variant,
  profile,
  security,
  devices = [],
  extensionData,
  defaultTab = 'profile',
}: AccountSettingsShellProps) {
  const [activeTab, setActiveTab] = useState<AccountTab>(defaultTab);

  const clientTabs: { id: AccountTab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Security' },
    { id: 'devices', label: 'Devices' },
    { id: 'extension', label: 'Extension' },
  ];

  const adminTabs: { id: AccountTab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Security' },
  ];

  const tabs = variant === 'admin' ? adminTabs : clientTabs;

  return (
    <div>
      <AccountTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'profile' && (
        <ProfileTab
          fullName={profile.fullName}
          role={profile.role}
          email={profile.email}
          accountStatus={profile.accountStatus}
        />
      )}

      {activeTab === 'security' && (
        <SecurityTab
          currentEmail={profile.email}
          emailTwoFactorEnabled={security.emailTwoFactorEnabled}
          mfaEnabled={security.mfaEnabled}
          activeDevices={devices.filter((d) => d.status === 'active')}
          accountPath={security.accountPath}
          emailChangeStatus={security.emailChangeStatus}
          pendingEmail={security.pendingEmail}
        />
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
    </div>
  );
}
