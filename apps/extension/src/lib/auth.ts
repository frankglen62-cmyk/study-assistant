import type { ExtensionState } from '@study-assistant/shared-types';

import { clearAuthState, updateState } from './state';

export function detectBrowserName(): string {
  const userAgent = navigator.userAgent;

  if (userAgent.includes('Edg/')) {
    return 'Microsoft Edge';
  }

  if (userAgent.includes('Chrome/')) {
    return 'Google Chrome';
  }

  return 'Chromium';
}

export function getExtensionVersion(): string {
  return chrome.runtime.getManifest().version;
}

export function requirePairing(state: ExtensionState): void {
  if (state.pairingStatus !== 'paired' || !state.accessToken || !state.appBaseUrl) {
    throw new Error('Pair the extension before continuing.');
  }
}

export async function revokeLocalAuth(browserName: string, extensionVersion: string): Promise<ExtensionState> {
  return updateState((current) => clearAuthState(current), browserName, extensionVersion);
}
