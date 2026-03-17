import type {
  ExtensionAnswerSuggestion,
  ExtensionCapturedSection,
  ExtensionNotice,
  ExtensionPageSignals,
  ExtensionRecentAction,
  ExtensionState,
} from '@study-assistant/shared-types';

import { extensionStateSchema } from './validators';

export const STORAGE_KEY = 'studyAssistantExtensionState';

const defaultSuggestion: ExtensionAnswerSuggestion = {
  answerText: null,
  shortExplanation: null,
  suggestedOption: null,
  questionSuggestions: [],
  subject: null,
  category: null,
  detectedSubject: null,
  detectedCategory: null,
  sourceSubject: null,
  sourceCategory: null,
  sourceScope: 'no_match',
  searchScope: 'subject_first',
  fallbackApplied: false,
  confidence: null,
  warning: 'No suggestion yet.',
  retrievalStatus: 'Ready',
};

export function createDefaultState(browserName = 'Chrome', extensionVersion = '0.0.0'): ExtensionState {
  return {
    appBaseUrl: '',
    pairingStatus: 'not_paired',
    uiStatus: 'not_connected',
    installationId: null,
    accessToken: null,
    refreshToken: null,
    deviceName: 'My Study Device',
    browserName,
    extensionVersion,
    creditsRemainingSeconds: 0,
    session: {
      sessionId: null,
      status: 'session_inactive',
      detectionMode: 'auto',
      liveAssistEnabled: false,
      manualSubject: '',
      manualCategory: '',
      lastActivityAt: null,
    },
    currentPage: null,
    capturedSections: [],
    lastSuggestion: defaultSuggestion,
    notices: [
      {
        id: crypto.randomUUID(),
        tone: 'info',
        title: 'Privacy',
        message: 'The extension only analyzes the current tab after you click Analyze or enable Live Assist.',
        createdAt: new Date().toISOString(),
      },
    ],
    recentActions: [],
    lastError: null,
    permissionOrigin: '',
    autoClickEnabled: false,
    autoPilotEnabled: false,
  };
}

export async function readState(browserName = 'Chrome', extensionVersion = '0.0.0'): Promise<ExtensionState> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const parsed = extensionStateSchema.safeParse(stored[STORAGE_KEY]);

  if (parsed.success) {
    return parsed.data;
  }

  const fallback = createDefaultState(browserName, extensionVersion);
  await writeState(fallback);
  return fallback;
}

export async function writeState(state: ExtensionState): Promise<ExtensionState> {
  const parsed = extensionStateSchema.parse(state);
  await chrome.storage.local.set({ [STORAGE_KEY]: parsed });
  return parsed;
}

export async function updateState(
  updater: (current: ExtensionState) => ExtensionState | Promise<ExtensionState>,
  browserName = 'Chrome',
  extensionVersion = '0.0.0',
): Promise<ExtensionState> {
  const current = await readState(browserName, extensionVersion);
  const next = await updater(current);
  return writeState(next);
}

export function appendNotice(current: ExtensionState, notice: Omit<ExtensionNotice, 'id' | 'createdAt'>): ExtensionState {
  return {
    ...current,
    notices: [
      {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...notice,
      },
      ...current.notices,
    ].slice(0, 8),
  };
}

export function appendRecentAction(current: ExtensionState, label: string): ExtensionState {
  const action: ExtensionRecentAction = {
    id: crypto.randomUUID(),
    label,
    createdAt: new Date().toISOString(),
  };

  return {
    ...current,
    recentActions: [action, ...current.recentActions].slice(0, 10),
  };
}

export function withCurrentPage(current: ExtensionState, page: ExtensionPageSignals): ExtensionState {
  return {
    ...current,
    currentPage: page,
    session: {
      ...current.session,
      lastActivityAt: page.extractedAt,
    },
  };
}

export function addCapturedSection(current: ExtensionState, section: ExtensionCapturedSection): ExtensionState {
  const remaining = current.capturedSections.filter((existing) => existing.digest !== section.digest);

  return {
    ...current,
    capturedSections: [section, ...remaining].slice(0, 8),
  };
}

export function clearCapturedSections(current: ExtensionState): ExtensionState {
  return {
    ...current,
    capturedSections: [],
  };
}

export function clearResults(current: ExtensionState): ExtensionState {
  return {
    ...current,
    currentPage: null,
    lastSuggestion: defaultSuggestion,
  };
}

export function clearAuthState(current: ExtensionState): ExtensionState {
  return {
    ...current,
    pairingStatus: current.pairingStatus === 'revoked' ? 'revoked' : 'not_paired',
    uiStatus: 'not_connected',
    installationId: null,
    accessToken: null,
    refreshToken: null,
    creditsRemainingSeconds: 0,
    capturedSections: [],
    session: {
      ...current.session,
      sessionId: null,
      status: 'session_inactive',
      liveAssistEnabled: false,
    },
  };
}
