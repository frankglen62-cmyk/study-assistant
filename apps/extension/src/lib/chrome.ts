import { normalizeAppUrl, normalizeOriginPattern } from '@study-assistant/shared-utils';

export type SiteAccessStatus = 'granted' | 'not_granted' | 'unsupported_page' | 'no_tab';

export interface SiteAccessResult {
  status: SiteAccessStatus;
  host: string;
  origin: string;
  tabUrl: string;
}

export async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

  if (!tab?.id || !tab.url) {
    throw new Error('No active tab was found.');
  }

  if (/^(chrome|edge|about|chrome-extension):/i.test(tab.url)) {
    throw new Error('The current tab cannot be analyzed.');
  }

  return tab;
}

/**
 * Non-throwing check: returns structured access status for the current active tab.
 */
export async function checkSiteAccess(): Promise<SiteAccessResult> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

    if (!tab?.id || !tab.url) {
      return { status: 'no_tab', host: '', origin: '', tabUrl: '' };
    }

    if (/^(chrome|edge|about|chrome-extension|devtools):/i.test(tab.url)) {
      return { status: 'unsupported_page', host: tab.url.split(':')[0] + ' page', origin: '', tabUrl: tab.url };
    }

    if (!/^https?:/i.test(tab.url)) {
      return { status: 'unsupported_page', host: tab.url, origin: '', tabUrl: tab.url };
    }

    const url = new URL(tab.url);
    const originPattern = normalizeOriginPattern(tab.url);
    const granted = await chrome.permissions.contains({ origins: [originPattern] });

    return {
      status: granted ? 'granted' : 'not_granted',
      host: url.hostname,
      origin: originPattern,
      tabUrl: tab.url,
    };
  } catch {
    return { status: 'no_tab', host: '', origin: '', tabUrl: '' };
  }
}

/**
 * Request permission for a specific site/host at runtime.
 */
export async function requestSitePermission(tabUrl: string): Promise<{ granted: boolean; host: string; origin: string }> {
  if (!/^https?:/i.test(tabUrl)) {
    return { granted: false, host: '', origin: '' };
  }

  const url = new URL(tabUrl);
  const originPattern = normalizeOriginPattern(tabUrl);

  const alreadyGranted = await chrome.permissions.contains({ origins: [originPattern] });
  if (alreadyGranted) {
    return { granted: true, host: url.hostname, origin: originPattern };
  }

  const granted = await chrome.permissions.request({ origins: [originPattern] });
  return { granted, host: url.hostname, origin: granted ? originPattern : '' };
}

export async function requestHostPermission(appBaseUrl: string): Promise<{ granted: boolean; origin: string }> {
  const normalizedBaseUrl = normalizeAppUrl(appBaseUrl);
  const originPattern = normalizeOriginPattern(normalizedBaseUrl);
  const alreadyGranted = await chrome.permissions.contains({ origins: [originPattern] });

  if (alreadyGranted) {
    return { granted: true, origin: originPattern };
  }

  const granted = await chrome.permissions.request({ origins: [originPattern] });
  return { granted, origin: granted ? originPattern : '' };
}

export async function ensureTabHostPermission(tabUrl: string): Promise<{ granted: boolean; origin: string }> {
  if (!/^https?:/i.test(tabUrl)) {
    throw new PermissionError(
      'This page cannot be analyzed because the browser does not allow extension access on this URL.',
      tabUrl,
    );
  }

  const originPattern = normalizeOriginPattern(tabUrl);
  const alreadyGranted = await chrome.permissions.contains({ origins: [originPattern] });

  if (alreadyGranted) {
    return { granted: true, origin: originPattern };
  }

  const host = new URL(tabUrl).hostname;
  throw new PermissionError(
    `Site access required for ${host}. Grant permission to analyze pages on this domain.`,
    tabUrl,
  );
}

/**
 * Custom error class for permission-related failures so they can be caught distinctly.
 */
export class PermissionError extends Error {
  public readonly tabUrl: string;
  constructor(message: string, tabUrl: string) {
    super(message);
    this.name = 'PermissionError';
    this.tabUrl = tabUrl;
  }
}

export async function openDashboard(baseUrl: string, path = '/dashboard'): Promise<void> {
  const target = baseUrl ? `${normalizeAppUrl(baseUrl)}${path}` : chrome.runtime.getURL('src/onboarding/index.html');
  await chrome.tabs.create({ url: target });
}

export async function captureVisibleScreenshot(windowId: number): Promise<string | null> {
  try {
    return await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  } catch {
    return null;
  }
}
