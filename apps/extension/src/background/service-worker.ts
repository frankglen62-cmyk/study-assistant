import { confidenceToLevel, normalizeAppUrl } from '@study-assistant/shared-utils';
import type {
  ExtensionCapturedSection,
  ExtensionPageSignals,
  ExtensionQuestionSuggestion,
  ExtensionState,
  ExtensionUiStatus,
} from '@study-assistant/shared-types';

import { detectBrowserName, getExtensionVersion, requirePairing } from '../lib/auth';
import {
  ApiError,
  analyzePage,
  endSession,
  exchangePairingCode,
  fetchSubjects,
  pauseSession,
  refreshExtensionToken,
  refreshWallet,
  revokeCurrentInstallation,
  resumeSession,
  startSession,
} from '../lib/api';
import { captureVisibleScreenshot, checkSiteAccess, ensureTabHostPermission, getActiveTab, openDashboard, PermissionError, requestHostPermission, requestSitePermission } from '../lib/chrome';
import type { SiteAccessResult } from '../lib/chrome';
import type {
  AnalyzeCurrentPagePayload,
  AutoClickAnswerPayload,
  AutoClickResult,
  ExtensionMessage,
  ExtensionResponse,
  LiveAssistSignalPayload,
  ManualOverridePayload,
  PairExtensionPayload,
  RequestPermissionPayload,
} from '../lib/messages';
import {
  appendNotice,
  appendRecentAction,
  addCapturedSection,
  clearAuthState,
  clearCapturedSections,
  createDefaultState,
  readState,
  updateState,
  withCurrentPage,
  writeState,
  clearResults,
  resetExam,
} from '../lib/state';
import { installExtractorContentScript } from '../content/extractor';

const browserName = detectBrowserName();
const extensionVersion = getExtensionVersion();
const AUTO_PILOT_ANALYZE_TIMEOUT_MS = 15_500;
const SESSION_EXPIRY_ALARM = 'study-assistant-session-expiry';
const CREDIT_REFRESH_ALARM = 'study-assistant-credit-refresh';
const IDLE_CHECK_ALARM = 'study-assistant-idle-check';
const IDLE_AUTO_END_MS = 10 * 60 * 1000; // 10 minutes of inactivity → auto-end session
const liveAssistTimers = new Map<number, number>();
let currentAnalyzeController: AbortController | null = null;
let autoPilotTabId: number | null = null; // Track the tab Full Auto is running on
let currentTokenRefreshPromise: Promise<ExtensionState> | null = null;

void initializeRuntime();

chrome.runtime.onInstalled.addListener(async () => {
  await initializeRuntime();
});

chrome.runtime.onStartup.addListener(async () => {
  await initializeRuntime();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SESSION_EXPIRY_ALARM) {
    void handleSessionCreditExpired('scheduled_expiry');
  } else if (alarm.name === CREDIT_REFRESH_ALARM) {
    void handlePeriodicCreditRefresh();
  } else if (alarm.name === IDLE_CHECK_ALARM) {
    void handleIdleCheck();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    void (async () => {
      try {
        const state = await readState(browserName, extensionVersion);
        if (state.autoPilotEnabled && state.session.status === 'session_active') {
          // Only run on the auto-pilot target tab (works even if user switches tabs)
          if (autoPilotTabId !== null && autoPilotTabId !== tabId) return;
          // If no tab stored yet, store whichever tab completed
          if (autoPilotTabId === null) autoPilotTabId = tabId;

          // Add a small delay to let the next question render, then analyze with auto-retry.
          setTimeout(async () => {
            try {
              const currentState = await readState(browserName, extensionVersion);
              if (currentState.autoPilotEnabled && currentState.session.status === 'session_active') {
                // Safety net: If we unexpectedly land on the summary or review page, stop Auto Pilot immediately.
                if (tab.url && (tab.url.includes('/mod/quiz/summary.php') || tab.url.includes('/mod/quiz/review.php'))) {
                  await updateState(
                    (current) =>
                      appendNotice(
                        {
                          ...current,
                          autoPilotEnabled: false,
                          uiStatus: 'suggestion_ready',
                        },
                        {
                          tone: 'success',
                          title: 'Done Answering!',
                          message: 'All questions have been answered. Auto Pilot has reached the summary page and stopped automatically.',
                        },
                      ),
                    browserName,
                    extensionVersion,
                  );
                  return;
                }
                
                await analyzeWithAutoRetry(2, AUTO_PILOT_ANALYZE_TIMEOUT_MS);
              }
            } catch (err) {
              console.error('Auto Pilot analysis failed on new page load:', err);
            }
          }, 900);
        }
      } catch (err) {
        console.error('Auto Pilot tab update check error:', err);
      }
    })();
  }
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  void (async () => {
    try {
      switch (message.type) {
        case 'EXTENSION/GET_STATE': {
          sendResponse(success(await readState(browserName, extensionVersion)));
          return;
        }
        case 'EXTENSION/GET_SUBJECTS': {
          sendResponse(success(await handleGetSubjects()));
          return;
        }
        case 'EXTENSION/REQUEST_HOST_PERMISSION': {
          const payload = message.payload as unknown as RequestPermissionPayload;
          sendResponse(success(await handleRequestPermission(payload)));
          return;
        }
        case 'EXTENSION/CHECK_SITE_ACCESS': {
          sendResponse(success(await handleCheckSiteAccess()));
          return;
        }
        case 'EXTENSION/GRANT_SITE_PERMISSION': {
          sendResponse(success(await handleGrantSitePermission()));
          return;
        }
        case 'EXTENSION/PAIR_EXTENSION': {
          const payload = message.payload as unknown as PairExtensionPayload;
          sendResponse(success(await handlePairExtension(payload)));
          return;
        }
        case 'EXTENSION/UNPAIR_BROWSER': {
          sendResponse(success(await handleUnpairBrowser()));
          return;
        }
        case 'EXTENSION/START_SESSION': {
          sendResponse(success(await handleSessionMutation('start')));
          return;
        }
        case 'EXTENSION/PAUSE_SESSION': {
          sendResponse(success(await handleSessionMutation('pause')));
          return;
        }
        case 'EXTENSION/RESUME_SESSION': {
          sendResponse(success(await handleSessionMutation('resume')));
          return;
        }
        case 'EXTENSION/END_SESSION': {
          sendResponse(success(await handleSessionMutation('end')));
          return;
        }
        case 'EXTENSION/ANALYZE_CURRENT_PAGE': {
          const payload = message.payload as unknown as AnalyzeCurrentPagePayload;
          sendResponse(success(await handleAnalyze(payload)));
          return;
        }
        case 'EXTENSION/CAPTURE_VISIBLE_SECTION': {
          sendResponse(success(await handleCaptureVisibleSection()));
          return;
        }
        case 'EXTENSION/CLEAR_CAPTURED_SECTIONS': {
          sendResponse(success(await handleClearCapturedSections()));
          return;
        }
        case 'EXTENSION/TOGGLE_LIVE_ASSIST': {
          const enabled = Boolean(message.payload && (message.payload as { enabled: boolean }).enabled);
          sendResponse(success(await handleToggleLiveAssist(enabled)));
          return;
        }
        case 'EXTENSION/SET_MANUAL_OVERRIDE': {
          const payload = message.payload as unknown as ManualOverridePayload;
          sendResponse(success(await handleManualOverride(payload)));
          return;
        }
        case 'EXTENSION/REFRESH_CREDITS': {
          sendResponse(success(await handleRefreshCredits()));
          return;
        }
        case 'EXTENSION/OPEN_DASHBOARD': {
          sendResponse(success(await handleOpenDashboard()));
          return;
        }
        case 'EXTENSION/REPORT_WRONG_DETECTION': {
          sendResponse(success(await handleReportWrongDetection()));
          return;
        }
        case 'EXTENSION/LIVE_ASSIST_SIGNAL': {
          const payload = message.payload as unknown as LiveAssistSignalPayload;
          sendResponse(success(await handleLiveAssistSignal(sender.tab?.id, payload)));
          return;
        }
        case 'EXTENSION/CLEAR_RESULTS': {
          sendResponse(success(await handleClearResults()));
          return;
        }
        case 'EXTENSION/TOGGLE_AUTO_CLICK': {
          const enabled = Boolean(message.payload && (message.payload as { enabled: boolean }).enabled);
          sendResponse(success(await handleToggleAutoClick(enabled)));
          return;
        }
        case 'EXTENSION/AUTO_CLICK_ALL': {
          sendResponse(success(await handleAutoClickAll()));
          return;
        }
        case 'EXTENSION/TOGGLE_AUTO_PILOT': {
          const enabled = Boolean(message.payload && (message.payload as { enabled: boolean }).enabled);
          sendResponse(success(await handleToggleAutoPilot(enabled)));
          return;
        }
        case 'EXTENSION/RESET_EXAM': {
          sendResponse(success(await handleResetExam()));
          return;
        }
        case 'EXTENSION/CANCEL_ANALYZE': {
          sendResponse(success(await handleCancelAnalyze()));
          return;
        }
        default:
          sendResponse(failure('Unsupported extension action.'));
      }
    } catch (error) {
      const messageText = await handleExtensionFailure(error);
      sendResponse(failure(messageText));
    }
  })();

  return true;
});

async function initializeRuntime(): Promise<void> {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  let current = await readState(browserName, extensionVersion);
  if (!current.browserName || !current.extensionVersion) {
    await writeState(createDefaultState(browserName, extensionVersion));
    return;
  }

  if (current.session.status === 'session_active' && !current.sessionCreditExpiresAt && current.creditsRemainingSeconds > 0) {
    current = await updateState(
      (existing) => ({
        ...existing,
        sessionCreditExpiresAt: buildSessionExpiry(existing.creditsRemainingSeconds, true),
      }),
      browserName,
      extensionVersion,
    );
  }

  await syncSessionExpiryAlarm(current);

  // Resume periodic alarms if session was already active (e.g. after browser restart)
  if (current.session.status === 'session_active') {
    await startPeriodicAlarms();
  }
}

function getEffectiveRemainingSeconds(state: ExtensionState, now = Date.now()) {
  if (state.session.status === 'session_active' && state.sessionCreditExpiresAt) {
    const expiry = new Date(state.sessionCreditExpiresAt).getTime();

    if (Number.isFinite(expiry)) {
      return Math.max(0, Math.floor((expiry - now) / 1000));
    }
  }

  return Math.max(0, state.creditsRemainingSeconds);
}

function buildSessionExpiry(remainingSeconds: number, active: boolean, now = Date.now()) {
  if (!active || remainingSeconds <= 0) {
    return null;
  }

  return new Date(now + remainingSeconds * 1000).toISOString();
}

async function syncSessionExpiryAlarm(state: ExtensionState) {
  await chrome.alarms.clear(SESSION_EXPIRY_ALARM);

  if (state.session.status !== 'session_active' || !state.sessionCreditExpiresAt) {
    return;
  }

  const expiresAt = new Date(state.sessionCreditExpiresAt).getTime();

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || getEffectiveRemainingSeconds(state) <= 0) {
    await handleSessionCreditExpired('expired_sync');
    return;
  }

  chrome.alarms.create(SESSION_EXPIRY_ALARM, {
    when: expiresAt,
  });
}

async function handleSessionCreditExpired(reason: string) {
  const state = await readState(browserName, extensionVersion);

  if (state.session.status !== 'session_active' && state.creditsRemainingSeconds === 0) {
    await syncSessionExpiryAlarm({
      ...state,
      sessionCreditExpiresAt: null,
    });
    return;
  }

  if (currentAnalyzeController) {
    currentAnalyzeController.abort(`Study time exhausted: ${reason}`);
    currentAnalyzeController = null;
  }

  autoPilotTabId = null;

  for (const timer of liveAssistTimers.values()) {
    clearTimeout(timer);
  }
  liveAssistTimers.clear();

  try {
    if (state.pairingStatus === 'paired' && state.session.status === 'session_active') {
      await withAuthRetry((current) => endSession(current));
    }
  } catch (error) {
    console.warn('Unable to end session after credits expired:', error);
  }

  const nextState = await updateState(
    (current) =>
      appendNotice(
        {
          ...current,
          uiStatus: 'no_credits',
          creditsRemainingSeconds: 0,
          sessionCreditExpiresAt: null,
          autoPilotEnabled: false,
          autoClickEnabled: false,
          lastError: 'No study time remains for this session.',
          session: {
            ...current.session,
            status: 'session_inactive',
            liveAssistEnabled: false,
          },
        },
        {
          tone: 'warning',
          title: 'Study time exhausted',
          message: 'No study time remains. Top up in the portal before continuing.',
        },
      ),
    browserName,
    extensionVersion,
  );

  await stopPeriodicAlarms();
  await syncSessionExpiryAlarm(nextState);
}

function success<T>(data: T): ExtensionResponse<T> {
  return { ok: true, data };
}

function failure(error: string): ExtensionResponse {
  return { ok: false, error };
}

async function recordError(error: string): Promise<void> {
  await updateState(
    (current) => {
      const lastNotice = current.notices[0];
      const isDuplicateError =
        lastNotice?.tone === 'danger' &&
        lastNotice.title === 'Extension error' &&
        lastNotice.message === error &&
        Date.now() - new Date(lastNotice.createdAt).getTime() < 15_000;

      if (isDuplicateError) {
        return {
          ...current,
          uiStatus: 'error',
          lastError: error,
        };
      }

      return appendNotice(
        {
          ...current,
          uiStatus: 'error',
          lastError: error,
        },
        {
          tone: 'danger',
          title: 'Extension error',
          message: error,
        },
      );
    },
    browserName,
    extensionVersion,
  );
}

async function handleExtensionFailure(error: unknown): Promise<string> {
  if (error instanceof ApiError) {
    // AUTO-RECOVER from "session not found" errors.
    // This happens when the server ended the session (timeout, credits exhausted)
    // but the extension still thinks it's active. Reset local state immediately.
    if (
      (error.code === 'session_not_found' ||
        error.code === 'no_active_session' ||
        error.message.toLowerCase().includes('active or paused session was not found')) &&
      error.status !== 401
    ) {
      const nextState = await updateState(
        (current) => {
          if (current.session.status === 'session_inactive') {
            // Already inactive — just record the error
            return appendNotice(
              { ...current, uiStatus: 'error', lastError: error.message },
              { tone: 'warning', title: 'No active session', message: 'Start a new session to continue.' },
            );
          }

          return appendNotice(
            appendRecentAction(
              {
                ...current,
                sessionCreditExpiresAt: null,
                autoPilotEnabled: false,
                autoClickEnabled: false,
                uiStatus: computeUiStatus(current, 'ready'),
                lastError: null,
                session: {
                  ...current.session,
                  sessionId: null,
                  status: 'session_inactive',
                  liveAssistEnabled: false,
                },
              },
              'Session Reset (Server)',
            ),
            {
              tone: 'info',
              title: 'Session ended by server',
              message: 'The previous session expired or was closed. Start a new session to continue.',
            },
          );
        },
        browserName,
        extensionVersion,
      );

      await stopPeriodicAlarms();
      await syncSessionExpiryAlarm(nextState);
      return error.message;
    }

    if (error.status === 400 && error.code === 'invalid_request') {
      await updateState(
        (current) =>
          appendNotice(
            {
              ...current,
              uiStatus: 'error',
              lastError: error.message,
            },
            {
              tone: 'warning',
              title: 'Extension request mismatch',
              message:
                'The loaded extension build sent an invalid analysis payload. Reload the extension in chrome://extensions, then retry Analyze Page.',
            },
          ),
        browserName,
        extensionVersion,
      );

      return error.message;
    }

    if (
      error.status === 401 &&
      (error.code === 'installation_revoked' ||
        error.code === 'installation_not_found' ||
        error.code === 'refresh_token_invalid' ||
        error.code === 'invalid_extension_token' ||
        error.code === 'extension_token_expired')
    ) {
      await updateState(
        (current) =>
          appendNotice(
            {
              ...clearAuthState({
                ...current,
                pairingStatus: error.code === 'installation_revoked' ? 'revoked' : current.pairingStatus,
              }),
              uiStatus: 'not_connected',
              lastError: error.message,
            },
            {
              tone: 'warning',
              title: error.code === 'installation_revoked' ? 'Device revoked' : 'Session expired',
              message:
                error.code === 'installation_revoked'
                  ? 'This paired device was revoked from the portal. Pair it again before continuing.'
                  : 'The extension token expired. Pair the extension again if refresh does not recover.',
            },
          ),
        browserName,
        extensionVersion,
      );

      return error.message;
    }

    if (error.status === 402 || error.code === 'insufficient_credits') {
      const nextState = await updateState(
        (current) =>
          appendNotice(
            {
              ...current,
              uiStatus: 'no_credits',
              creditsRemainingSeconds: 0,
              sessionCreditExpiresAt: null,
              autoPilotEnabled: false,
              autoClickEnabled: false,
              session: {
                ...current.session,
                status: 'session_inactive',
                liveAssistEnabled: false,
              },
              lastError: error.message,
            },
            {
              tone: 'warning',
              title: 'No credits available',
              message: error.message,
            },
          ),
        browserName,
        extensionVersion,
      );

      await syncSessionExpiryAlarm(nextState);
      return error.message;
    }

    if (error.status === 403 && error.code === 'wallet_locked') {
      const nextState = await updateState(
        (current) =>
          appendNotice(
            {
              ...current,
              uiStatus: 'error',
              sessionCreditExpiresAt: null,
              autoPilotEnabled: false,
              autoClickEnabled: false,
              session: {
                ...current.session,
                status: 'session_inactive',
                liveAssistEnabled: false,
              },
              lastError: error.message,
            },
            {
              tone: 'warning',
              title: 'Wallet locked',
              message: error.message,
            },
          ),
        browserName,
        extensionVersion,
      );

      await syncSessionExpiryAlarm(nextState);
      return error.message;
    }

    if (error.status === 403 && error.code === 'account_inactive') {
      const nextState = await updateState(
        (current) =>
          appendNotice(
            {
              ...current,
              uiStatus: 'error',
              sessionCreditExpiresAt: null,
              autoPilotEnabled: false,
              autoClickEnabled: false,
              session: {
                ...current.session,
                status: 'session_inactive',
                liveAssistEnabled: false,
              },
              lastError: error.message,
            },
            {
              tone: 'warning',
              title: 'Account unavailable',
              message: error.message,
            },
          ),
        browserName,
        extensionVersion,
      );

      await syncSessionExpiryAlarm(nextState);
      return error.message;
    }

    if (error.status === 503 && error.code === 'maintenance_mode') {
      const nextState = await updateState(
        (current) =>
          appendNotice(
            {
              ...current,
              uiStatus: 'maintenance',
              sessionCreditExpiresAt: null,
              autoPilotEnabled: false,
              autoClickEnabled: false,
              session: {
                ...current.session,
                status: 'session_inactive',
                liveAssistEnabled: false,
              },
              lastError: error.message,
            },
            {
              tone: 'warning',
              title: 'Maintenance mode',
              message: error.message,
            },
          ),
        browserName,
        extensionVersion,
      );

      await syncSessionExpiryAlarm(nextState);
      return error.message;
    }
  }

  const messageText = error instanceof Error ? error.message : 'Unexpected extension error.';

  // Handle permission errors with deduplication
  if (error instanceof PermissionError) {
    const host = (() => {
      try { return new URL(error.tabUrl).hostname; }
      catch { return 'this site'; }
    })();

    await updateState(
      (current) => {
        // Deduplicate: check if the last notice is already about the same permission issue
        const lastNotice = current.notices[0];
        if (
          lastNotice &&
          lastNotice.title === 'Site access required' &&
          lastNotice.message.includes(host) &&
          Date.now() - new Date(lastNotice.createdAt).getTime() < 10_000
        ) {
          // Skip duplicate notice, just update status
          return {
            ...current,
            uiStatus: 'error',
            lastError: messageText,
          };
        }

        return appendNotice(
          {
            ...current,
            uiStatus: 'error',
            lastError: messageText,
          },
          {
            tone: 'warning',
            title: 'Site access required',
            message: `Grant permission for ${host} to analyze pages on this domain.`,
          },
        );
      },
      browserName,
      extensionVersion,
    );

    return messageText;
  }

  await recordError(messageText);
  return messageText;
}

function computeUiStatus(state: ExtensionState, fallback: ExtensionUiStatus = 'ready'): ExtensionUiStatus {
  if (state.uiStatus === 'maintenance') {
    return 'maintenance';
  }

  if (state.pairingStatus !== 'paired') {
    return 'not_connected';
  }

  if (getEffectiveRemainingSeconds(state) === 0) {
    return 'no_credits';
  }

  return fallback;
}

async function handleRequestPermission(payload: RequestPermissionPayload) {
  const { granted, origin } = await requestHostPermission(payload.appBaseUrl);

  const nextState = await updateState(
    (current) =>
      appendNotice(
        {
          ...current,
          appBaseUrl: normalizeAppUrl(payload.appBaseUrl),
          permissionOrigin: origin,
        },
        granted
          ? {
            tone: 'success',
            title: 'Connection allowed',
            message: `The extension can now reach ${normalizeAppUrl(payload.appBaseUrl)}.`,
          }
          : {
            tone: 'warning',
            title: 'Permission denied',
            message: 'Allow the app origin to continue with secure pairing.',
          },
      ),
    browserName,
    extensionVersion,
  );

  return { granted, state: nextState };
}

async function handleCheckSiteAccess(): Promise<SiteAccessResult> {
  return checkSiteAccess();
}

async function handleGrantSitePermission() {
  const access = await checkSiteAccess();

  if (access.status === 'unsupported_page' || access.status === 'no_tab') {
    return { granted: false, access };
  }

  if (access.status === 'granted') {
    return { granted: true, access };
  }

  const result = await requestSitePermission(access.tabUrl);
  const updatedAccess = await checkSiteAccess();

  if (result.granted) {
    await updateState(
      (current) =>
        appendNotice(
          appendRecentAction(current, `Site access granted: ${result.host}`),
          {
            tone: 'success',
            title: 'Site access granted',
            message: `You can now analyze pages on ${result.host}.`,
          },
        ),
      browserName,
      extensionVersion,
    );
  } else {
    await updateState(
      (current) =>
        appendNotice(current, {
          tone: 'warning',
          title: 'Permission denied',
          message: `Site access was not granted for ${access.host}. Analysis features remain disabled for this domain.`,
        }),
      browserName,
      extensionVersion,
    );
  }

  return { granted: result.granted, access: updatedAccess };
}

async function handlePairExtension(payload: PairExtensionPayload) {
  const permission = await requestHostPermission(payload.appBaseUrl);
  if (!permission.granted) {
    throw new Error('Allow the app connection permission before pairing this browser.');
  }

  await updateState(
    (current) =>
      appendNotice(
        {
          ...current,
          appBaseUrl: normalizeAppUrl(payload.appBaseUrl),
          permissionOrigin: permission.origin,
          deviceName: payload.deviceName,
          lastError: null,
        },
        {
          tone: 'info',
          title: 'App origin confirmed',
          message: `The extension can reach ${normalizeAppUrl(payload.appBaseUrl)} for secure pairing and API requests.`,
        },
      ),
    browserName,
    extensionVersion,
  );

  const state = await readState(browserName, extensionVersion);
  const result = await exchangePairingCode(state, {
    pairingCode: payload.pairingCode,
    deviceName: payload.deviceName,
    browserName,
    extensionVersion,
  });

  const nextState = await updateState(
    (current) =>
      appendNotice(
        appendRecentAction(
          {
            ...current,
            pairingStatus: 'paired',
            uiStatus: result.remainingSeconds > 0 ? 'ready' : 'no_credits',
            installationId: result.installationId,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            creditsRemainingSeconds: result.remainingSeconds,
            sessionCreditExpiresAt: buildSessionExpiry(
              result.remainingSeconds,
              result.sessionStatus === 'session_active',
            ),
            session: {
              ...current.session,
              status: result.sessionStatus,
            },
            lastError: null,
          },
          'Pair Extension',
        ),
        {
          tone: 'success',
          title: 'Extension paired',
          message: `Device ${payload.deviceName} is now linked to ${normalizeAppUrl(payload.appBaseUrl)}.`,
        },
      ),
    browserName,
    extensionVersion,
  );

  await syncSessionExpiryAlarm(nextState);

  return nextState;
}

async function handleSessionMutation(mode: 'start' | 'pause' | 'resume' | 'end') {
  let response;

  try {
    response = await withAuthRetry((state) =>
      mode === 'start'
        ? startSession(state)
        : mode === 'pause'
          ? pauseSession(state)
          : mode === 'resume'
            ? resumeSession(state)
            : endSession(state),
    );
  } catch (error) {
    // CRITICAL FIX: If End/Pause/Resume fails because the server session
    // already expired, force-reset local state to inactive instead of
    // leaving the extension stuck in "Session is live" forever.
    if (
      mode !== 'start' &&
      error instanceof ApiError &&
      (error.message.toLowerCase().includes('session') ||
        error.code === 'session_not_found' ||
        error.code === 'no_active_session')
    ) {
      const nextState = await updateState(
        (current) =>
          appendNotice(
            appendRecentAction(
              {
                ...current,
                sessionCreditExpiresAt: null,
                autoPilotEnabled: false,
                autoClickEnabled: false,
                session: {
                  ...current.session,
                  sessionId: null,
                  status: 'session_inactive',
                  liveAssistEnabled: false,
                },
                uiStatus: computeUiStatus(current, 'ready'),
              },
              mode === 'end' ? 'End Session' : `${mode.charAt(0).toUpperCase() + mode.slice(1)} Session`,
            ),
            {
              tone: 'info',
              title: 'Session ended',
              message: 'The previous session was already closed by the server. You can start a new session.',
            },
          ),
        browserName,
        extensionVersion,
      );

      await stopPeriodicAlarms();
      await syncSessionExpiryAlarm(nextState);
      return nextState;
    }

    throw error;
  }

  const actionMap = {
    start: 'Start Session',
    pause: 'Pause Session',
    resume: 'Resume Session',
    end: 'End Session',
  } as const;

  const nextState = await updateState(
    (current) => {
      const remainingSeconds = response.remainingSeconds ?? current.creditsRemainingSeconds;
      const nextSessionStatus = response.status;

      return appendRecentAction(
        {
          ...current,
          uiStatus: computeUiStatus(
            {
              ...current,
              creditsRemainingSeconds: remainingSeconds,
              sessionCreditExpiresAt: buildSessionExpiry(remainingSeconds, nextSessionStatus === 'session_active'),
            },
            'ready',
          ),
          creditsRemainingSeconds: remainingSeconds,
          sessionCreditExpiresAt: buildSessionExpiry(remainingSeconds, nextSessionStatus === 'session_active'),
          session: {
            ...current.session,
            sessionId: nextSessionStatus === 'session_inactive' ? null : response.sessionId,
            status: nextSessionStatus,
            detectionMode: response.detectionMode,
            lastActivityAt: new Date().toISOString(),
          },
        },
        actionMap[mode],
      );
    },
    browserName,
    extensionVersion,
  );

  // Start/stop periodic alarms based on session state
  if (response.status === 'session_active') {
    await startPeriodicAlarms();
  } else {
    await stopPeriodicAlarms();
  }

  await syncSessionExpiryAlarm(nextState);

  return nextState;
}

async function handleGetSubjects() {
  const catalog = await withAuthRetry((state) => fetchSubjects(state));
  return catalog;
}

async function handleUnpairBrowser() {
  const state = await readState(browserName, extensionVersion);
  requirePairing(state);

  if (currentAnalyzeController) {
    currentAnalyzeController.abort('Browser unpaired');
    currentAnalyzeController = null;
  }

  autoPilotTabId = null;

  for (const timer of liveAssistTimers.values()) {
    clearTimeout(timer);
  }
  liveAssistTimers.clear();

  if (state.session.status !== 'session_inactive') {
    try {
      await withAuthRetry((current) => endSession(current));
    } catch (error) {
      console.warn('Unable to end session before unpairing:', error);
    }
  }

  await withAuthRetry((current) => revokeCurrentInstallation(current));

  const nextState = await updateState(
    (current) =>
      appendNotice(
        appendRecentAction(
          {
            ...clearAuthState({
              ...current,
              pairingStatus: 'not_paired',
              lastError: null,
            }),
          },
          'Unpair Browser',
        ),
        {
          tone: 'success',
          title: 'Browser unpaired',
          message: 'This browser was disconnected from your client account. Open pairing mode to connect it again.',
        },
      ),
    browserName,
    extensionVersion,
  );

  await syncSessionExpiryAlarm(nextState);
  return nextState;
}

async function injectExtractor(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: installExtractorContentScript,
  });
}

async function requestPageSignals(tabId: number) {
  await injectExtractor(tabId);

  const response = (await chrome.tabs.sendMessage(tabId, {
    type: 'EXTENSION/EXTRACT_PAGE_SIGNALS',
  })) as ExtensionResponse<ExtensionPageSignals>;

  if (!response?.ok || !response.data) {
    throw new Error(response?.error ?? 'Page extraction failed.');
  }

  return response.data;
}

function createFallbackSignals(tab: chrome.tabs.Tab): ExtensionPageSignals {
  const url = new URL(tab.url!);

  return {
    pageUrl: tab.url!,
    pageDomain: url.hostname,
    pageTitle: tab.title?.trim() || url.hostname,
    headings: [],
    breadcrumbs: [],
    visibleLabels: [],
    visibleTextExcerpt: '',
    questionText: null,
    options: [],
    questionCandidates: [],
    diagnostics: {
      explicitQuestionBlockCount: 0,
      structuredQuestionBlockCount: 0,
      groupedInputCount: 0,
      promptCandidateCount: 0,
      questionCandidateCount: 0,
      visibleOptionCount: 0,
      courseCodeCount: 0,
    },
    courseCodes: [],
    quizTitle: null,
    quizNumber: null,
    totalQuestionsDetected: 0,
    extractedAt: new Date().toISOString(),
  };
}

function computeSectionDigest(pageSignals: ExtensionPageSignals) {
  return [
    pageSignals.pageUrl,
    pageSignals.pageTitle,
    pageSignals.questionCandidates
      .slice(0, 4)
      .map((candidate) => `${candidate.prompt}::${candidate.options.join('|')}`)
      .join('|'),
    pageSignals.questionText ?? '',
    pageSignals.visibleTextExcerpt.slice(0, 240),
  ]
    .join(' | ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 700);
}

function createCapturedSection(pageSignals: ExtensionPageSignals): ExtensionCapturedSection {
  return {
    id: crypto.randomUUID(),
    digest: computeSectionDigest(pageSignals),
    pageUrl: pageSignals.pageUrl,
    pageTitle: pageSignals.pageTitle,
    questionCount: pageSignals.questionCandidates.length || (pageSignals.questionText ? 1 : 0),
    capturedAt: new Date().toISOString(),
    pageSignals,
  };
}

function mergeCapturedSections(sections: ExtensionCapturedSection[]): ExtensionPageSignals {
  const base = sections[0];
  if (!base) {
    throw new Error('Capture at least one visible section before merging suggestions.');
  }

  const dedupe = (values: string[], limit: number) =>
    Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);

  const questionCandidates = Array.from(
    new Map(
      sections
        .flatMap((section) => section.pageSignals.questionCandidates)
        .map((candidate) => [
          `${candidate.prompt.toLowerCase()}::${candidate.options.join('|').toLowerCase()}`,
          candidate,
        ]),
    ).values(),
  );

  const visibleTextExcerpt = sections
    .map((section) => section.pageSignals.visibleTextExcerpt)
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4000);

  const questionText = questionCandidates[0]?.prompt ?? base.pageSignals.questionText ?? null;
  const options = questionCandidates[0]?.options ?? base.pageSignals.options;

  return {
    pageUrl: base.pageSignals.pageUrl,
    pageDomain: base.pageSignals.pageDomain,
    pageTitle:
      sections.length > 1
        ? `${base.pageSignals.pageTitle} + ${sections.length - 1} more captured section${sections.length > 2 ? 's' : ''}`
        : base.pageSignals.pageTitle,
    headings: dedupe(sections.flatMap((section) => section.pageSignals.headings), 16),
    breadcrumbs: dedupe(sections.flatMap((section) => section.pageSignals.breadcrumbs), 12),
    visibleLabels: dedupe(sections.flatMap((section) => section.pageSignals.visibleLabels), 20),
    visibleTextExcerpt,
    questionText,
    options: options.slice(0, 10),
    questionCandidates,
    diagnostics: {
      explicitQuestionBlockCount: sections.reduce(
        (total, section) => total + section.pageSignals.diagnostics.explicitQuestionBlockCount,
        0,
      ),
      structuredQuestionBlockCount: sections.reduce(
        (total, section) => total + section.pageSignals.diagnostics.structuredQuestionBlockCount,
        0,
      ),
      groupedInputCount: sections.reduce(
        (total, section) => total + section.pageSignals.diagnostics.groupedInputCount,
        0,
      ),
      promptCandidateCount: sections.reduce(
        (total, section) => total + section.pageSignals.diagnostics.promptCandidateCount,
        0,
      ),
      questionCandidateCount: questionCandidates.length,
      visibleOptionCount: Array.from(
        new Set(questionCandidates.flatMap((candidate) => candidate.options.map((option) => option.toLowerCase()))),
      ).length,
      courseCodeCount: dedupe(sections.flatMap((section) => section.pageSignals.courseCodes), 10).length,
    },
    courseCodes: dedupe(sections.flatMap((section) => section.pageSignals.courseCodes), 10),
    quizTitle: sections.find((s) => s.pageSignals.quizTitle)?.pageSignals.quizTitle ?? null,
    quizNumber: sections.find((s) => s.pageSignals.quizNumber)?.pageSignals.quizNumber ?? null,
    totalQuestionsDetected: questionCandidates.length,
    extractedAt: new Date().toISOString(),
  };
}

async function collectCurrentPageContext(includeScreenshot: boolean, overrideTabId?: number) {
  let tab: chrome.tabs.Tab;

  if (overrideTabId) {
    // Use the specified tab directly (for background tab support)
    const tabInfo = await chrome.tabs.get(overrideTabId);
    if (!tabInfo?.url) throw new Error('The target tab no longer exists or has no URL.');
    tab = tabInfo;
  } else {
    tab = await getActiveTab();
  }
  await ensureTabHostPermission(tab.url!);

  let screenshotDataUrl = includeScreenshot ? await captureVisibleScreenshot(tab.windowId) : null;
  let pageSignals: ExtensionPageSignals;

  try {
    pageSignals = await requestPageSignals(tab.id!);
  } catch (error) {
    if (!screenshotDataUrl) {
      screenshotDataUrl = await captureVisibleScreenshot(tab.windowId);
    }

    if (!screenshotDataUrl) {
      throw error;
    }

    pageSignals = createFallbackSignals(tab);
  }

  if (!pageSignals.questionText && pageSignals.visibleTextExcerpt.length < 120 && !screenshotDataUrl) {
    screenshotDataUrl = await captureVisibleScreenshot(tab.windowId);
  }

  return {
    tab,
    pageSignals,
    screenshotDataUrl,
  };
}

async function handleCaptureVisibleSection() {
  const state = await readState(browserName, extensionVersion);
  requirePairing(state);

  const { pageSignals } = await collectCurrentPageContext(false);
  const section = createCapturedSection(pageSignals);

  const nextState = await updateState(
    (current) => {
      const duplicate = current.capturedSections.some((existing) => existing.digest === section.digest);

      return appendNotice(
        appendRecentAction(
          withCurrentPage(addCapturedSection(current, section), pageSignals),
          duplicate ? 'Update Captured Section' : 'Capture Visible Section',
        ),
        {
          tone: 'info',
          title: duplicate ? 'Section updated' : 'Section captured',
          message:
            section.questionCount > 0
              ? `${section.questionCount} visible question${section.questionCount > 1 ? 's were' : ' was'} added to the manual capture list.`
              : 'The current visible section was captured for later merged analysis.',
        },
      );
    },
    browserName,
    extensionVersion,
  );

  return nextState;
}

async function handleClearCapturedSections() {
  const nextState = await updateState(
    (current) =>
      appendNotice(
        appendRecentAction(clearCapturedSections(current), 'Reset Captured Sections'),
        {
          tone: 'warning',
          title: 'Captured sections cleared',
          message: 'The manual multi-section capture list was reset for this browser session.',
        },
      ),
    browserName,
    extensionVersion,
  );

  return nextState;
}
async function handleCancelAnalyze() {
  if (currentAnalyzeController) {
    currentAnalyzeController.abort('User cancelled the search');
    currentAnalyzeController = null;
  }

  const currentState = await readState(browserName, extensionVersion);
  if (['scanning_page', 'detecting_subject', 'searching_sources'].includes(currentState.uiStatus)) {
    return updateState(
      (current) => ({
        ...current,
        autoPilotEnabled: false,
        uiStatus: current.lastSuggestion.questionSuggestions.length > 0 ? 'suggestion_ready' : 'ready',
        lastError: 'Answer search was cancelled by user.',
        session: {
          ...current.session,
          liveAssistEnabled: false,
        },
      }),
      browserName,
      extensionVersion,
    );
  }
  return currentState;
}

/**
 * Wraps handleAnalyze with a timeout and auto-retry mechanism for Full Auto mode.
 * If analysis doesn't complete within timeoutMs, it retries up to maxAttempts times.
 * This prevents the Full Auto flow from freezing when the API is slow.
 */
async function analyzeWithAutoRetry(maxAttempts: number = 2, timeoutMs: number = AUTO_PILOT_ANALYZE_TIMEOUT_MS) {
  const TIMEOUT_SENTINEL = Symbol('TIMEOUT');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Re-check auto pilot is still enabled before each attempt
    const currentState = await readState(browserName, extensionVersion);
    if (!currentState.autoPilotEnabled || currentState.session.status !== 'session_active') {
      return; // Auto pilot was disabled, stop retrying
    }

    try {
      const result = await Promise.race([
        handleAnalyze({ mode: 'analyze', source: 'current', searchScope: 'subject_first' }),
        new Promise<typeof TIMEOUT_SENTINEL>((resolve) =>
          setTimeout(() => resolve(TIMEOUT_SENTINEL), timeoutMs)
        ),
      ]);

      if (result === TIMEOUT_SENTINEL) {
        console.warn(`Auto Pilot: Analysis attempt ${attempt}/${maxAttempts} timed out after ${timeoutMs}ms, ${attempt < maxAttempts ? 'retrying...' : 'pausing.'}`);

        // CRITICAL: Actively kill the underlying fetch request before proceeding
        if (currentAnalyzeController) {
          currentAnalyzeController.abort('Auto Pilot Timeout');
          currentAnalyzeController = null;
        }

        if (attempt < maxAttempts) {
          // Update state to show retrying
          await updateState(
            (current) =>
              appendNotice(current, {
                tone: 'warning',
                title: 'Retrying analysis',
                message: `Answer search timed out. Auto-retrying... (attempt ${attempt + 1}/${maxAttempts})`,
              }),
            browserName,
            extensionVersion,
          );
          continue; // Retry
        }
      } else {
        return result; // Success!
      }
    } catch (error) {
      console.error(`Auto Pilot: Analysis attempt ${attempt}/${maxAttempts} failed:`, error);
      if (attempt < maxAttempts) {
        await updateState(
          (current) =>
            appendNotice(current, {
              tone: 'warning',
              title: 'Retrying analysis',
              message: `Analysis failed. Auto-retrying... (attempt ${attempt + 1}/${maxAttempts})`,
            }),
          browserName,
          extensionVersion,
        );
        continue; // Retry
      }
      // Don't rethrow — fall through to the recovery below
    }
  }

  // ─── All attempts exhausted: reset UI, skip this question, move to next ───
  console.warn('Auto Pilot: All analysis attempts exhausted. Pausing on the current question.');
  if (currentAnalyzeController) {
    currentAnalyzeController.abort('All attempts exhausted');
    currentAnalyzeController = null;
  }

  await updateState(
    (current) =>
      appendNotice(
        {
          ...current,
          autoPilotEnabled: false,
          uiStatus: current.lastSuggestion.questionSuggestions.length > 0 ? 'suggestion_ready' : 'ready',
        },
        {
          tone: 'warning',
          title: 'Auto Pilot paused',
          message: 'The answer search took too long. Review the current question and restart Full Auto when the page is ready.',
        },
      ),
    browserName,
    extensionVersion,
  );
}

async function handleAnalyze(payload: AnalyzeCurrentPagePayload) {
  let state = await readState(browserName, extensionVersion);
  requirePairing(state);

  if (state.uiStatus === 'maintenance') {
    throw new Error('The portal is under maintenance. Please try again after the admin reopens access.');
  }

  if (getEffectiveRemainingSeconds(state) <= 0) {
    await handleSessionCreditExpired('pre_analyze_guard');
    throw new Error('No study time remains for this session.');
  }

  if (state.session.status !== 'session_active') {
    throw new Error('Start a session before analyzing the current page.');
  }

  const modeStatus: Record<AnalyzeCurrentPagePayload['mode'], ExtensionUiStatus> = {
    analyze: 'scanning_page',
    detect: 'detecting_subject',
    suggest: 'searching_sources',
  };

  state = await updateState(
    (current) => ({
      ...current,
      uiStatus: modeStatus[payload.mode],
      lastError: null,
      lastSuggestion: createDefaultState(browserName, extensionVersion).lastSuggestion,
    }),
    browserName,
    extensionVersion,
  );

  const source = payload.source ?? 'current';
  let screenshotDataUrl: string | null = null;
  let pageSignals: ExtensionPageSignals;

  if (source === 'captured') {
    if (state.capturedSections.length === 0) {
      throw new Error('Capture at least one visible section before merging suggestions.');
    }

    pageSignals = mergeCapturedSections(state.capturedSections);
  } else {
    // Use the stored auto-pilot tab or the active tab
    const targetTab = autoPilotTabId ?? undefined;
    const currentContext = await collectCurrentPageContext(payload.includeScreenshot ?? false, targetTab);
    screenshotDataUrl = currentContext.screenshotDataUrl;
    pageSignals = currentContext.pageSignals;
  }

  state = await updateState(
    (current) => withCurrentPage(current, pageSignals),
    browserName,
    extensionVersion,
  );

  if (currentAnalyzeController) {
    currentAnalyzeController.abort(); // Cancel any existing search before starting a new one
  }
  const analyzeController = new AbortController();
  currentAnalyzeController = analyzeController;

  let response;
  try {
    response = await withAuthRetry((freshState) =>
      analyzePage(freshState, {
        mode: payload.mode,
        pageSignals,
        screenshotDataUrl,
        manualSubject: freshState.session.manualSubject,
        manualCategory: freshState.session.manualCategory,
        searchScope: payload.searchScope ?? 'subject_first',
        sessionId: freshState.session.sessionId,
        liveAssist: freshState.session.liveAssistEnabled,
        forceRedetect: payload.forceRedetect ?? false,
        signal: analyzeController.signal,
      }),
    );
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'AbortError' || error.message.includes('cancelled') || error.message.includes('Timeout')) {
      console.warn('handleAnalyze was aborted:', error);
      // Cleanly revert state without saving any bad suggestions
      return updateState(
        (current) => ({
          ...current,
          uiStatus: current.lastSuggestion.questionSuggestions.length > 0 ? 'suggestion_ready' : 'ready', // best guess rollback
        }),
        browserName,
        extensionVersion,
      );
    }
    throw error;
  } finally {
    if (currentAnalyzeController === analyzeController) {
      currentAnalyzeController = null;
    }
  }

  const creditsRemainingSeconds = response.remainingSeconds ?? getEffectiveRemainingSeconds(state);
  const nextStatus =
    creditsRemainingSeconds === 0
      ? 'no_credits'
      : response.sourceScope === 'no_match' || response.warning?.toLowerCase().includes('no match') || !response.subject
        ? 'no_match_found'
        : confidenceToLevel(response.confidence) === 'low'
          ? 'low_confidence'
          : 'suggestion_ready';

  const nextState = await updateState(
    (current) =>
      appendRecentAction(
        appendNotice(
          {
            ...current,
            uiStatus: nextStatus,
            creditsRemainingSeconds,
            sessionCreditExpiresAt: buildSessionExpiry(
              creditsRemainingSeconds,
              creditsRemainingSeconds > 0 && current.session.status === 'session_active',
            ),
            lastSuggestion: {
              answerText: response.answerText,
              shortExplanation: response.shortExplanation,
              suggestedOption: response.suggestedOption,
              questionSuggestions: response.questionSuggestions,
              subject: response.subject,
              category: response.category,
              detectedSubject: response.detectedSubject,
              detectedCategory: response.detectedCategory,
              sourceSubject: response.sourceSubject,
              sourceCategory: response.sourceCategory,
              sourceScope: response.sourceScope,
              searchScope: response.searchScope,
              fallbackApplied: response.fallbackApplied,
              confidence: response.confidence,
              warning: response.warning,
              retrievalStatus: response.retrievalStatus,
            },
            session: {
              ...current.session,
              status: creditsRemainingSeconds === 0 ? 'session_inactive' : current.session.status,
              liveAssistEnabled: creditsRemainingSeconds === 0 ? false : current.session.liveAssistEnabled,
              lastActivityAt: new Date().toISOString(),
            },
          },
          {
            tone: nextStatus === 'suggestion_ready' ? 'success' : 'warning',
            title:
              payload.mode === 'detect'
                ? 'Detection complete'
                : source === 'captured'
                  ? 'Merged analysis complete'
                  : 'Analysis complete',
            message:
              response.warning ??
              `${response.detectedSubject ?? response.subject ?? 'Unknown subject'}${response.sourceSubject && response.sourceSubject !== response.detectedSubject
                  ? ` -> ${response.sourceSubject}`
                  : ''
                } ${response.confidence !== null ? `at ${Math.round(response.confidence * 100)}% confidence` : ''
                }`.trim(),
          },
        ),
        payload.mode === 'detect'
          ? 'Detect Subject'
          : source === 'captured'
            ? 'Merge Suggestions'
            : 'Analyze Current Page',
      ),
    browserName,
    extensionVersion,
  );

  await syncSessionExpiryAlarm(nextState);

  // Cache detected subject for future analyses (skip re-detection)
  if (response.detectedSubject && response.subject) {
    await updateState(
      (current) => ({
        ...current,
        session: {
          ...current.session,
          cachedSubjectId: (response as any).detectedSubjectId ?? current.session.cachedSubjectId,
          cachedSubjectName: response.detectedSubject ?? current.session.cachedSubjectName,
        },
      }),
      browserName,
      extensionVersion,
    );
  }

  // Always auto-click matched answers after successful analysis
  if (nextStatus === 'no_credits') {
    await handleSessionCreditExpired('post_analyze_zero');
    return readState(browserName, extensionVersion);
  }

  if (nextStatus === 'suggestion_ready' && nextState.lastSuggestion.questionSuggestions.length > 0) {
    try {
      const clickedState = await performAutoClickAll(nextState);
      return clickedState;
    } catch {
      // Auto-click failure is non-fatal, return the analyze result anyway
    }
  }

  // ─── Full Auto: Still click Next Page even when no match found ───
  // This prevents Full Auto from freezing on no-match questions
  if (nextState.autoPilotEnabled && nextState.session.status === 'session_active') {
    return updateState(
      (current) =>
        appendNotice(
          {
            ...current,
            autoPilotEnabled: false,
            uiStatus: nextStatus,
          },
          {
            tone: 'warning',
            title: 'Auto Pilot paused',
            message: 'No confirmed answer was inserted for the current page. Review the result before continuing.',
          },
        ),
      browserName,
      extensionVersion,
    );
  }

  return nextState;
}

async function handleResetExam() {
  // Disable live assist on the current tab if possible
  try {
    const tab = await getActiveTab();
    if (tab?.id) {
      await injectExtractor(tab.id);
      await chrome.tabs.sendMessage(tab.id, {
        type: 'EXTENSION/SET_LIVE_ASSIST',
        payload: { enabled: false },
      }).catch(() => { });
    }
  } catch {
    // Non-fatal: tab may not be available
  }

  const nextState = await updateState(
    (current) =>
      appendNotice(
        appendRecentAction(resetExam(current), 'New Exam'),
        {
          tone: 'success',
          title: 'Ready for new exam',
          message: 'All results, detected subject, and automation settings have been reset. Start fresh!',
        },
      ),
    browserName,
    extensionVersion,
  );

  return nextState;
}

async function handleClearResults() {
  const nextState = await updateState(
    (current) => {
      return appendNotice(
        appendRecentAction(clearResults(current), 'Clear Results'),
        {
          tone: 'info',
          title: 'Results cleared',
          message: 'The current study results and detected questions have been cleared.',
        },
      );
    },
    browserName,
    extensionVersion,
  );

  return nextState;
}

async function handleToggleAutoClick(enabled: boolean) {
  const nextState = await updateState(
    (current) =>
      appendNotice(
        appendRecentAction(
          {
            ...current,
            autoClickEnabled: enabled,
          },
          enabled ? 'Enable Auto-Click' : 'Disable Auto-Click',
        ),
        {
          tone: enabled ? 'success' : 'info',
          title: enabled ? 'Auto-click enabled' : 'Auto-click disabled',
          message: enabled
            ? 'The extension will automatically click the correct answer for each detected question after analysis.'
            : 'Auto-click is now disabled. Only suggestions will be shown.',
        },
      ),
    browserName,
    extensionVersion,
  );

  return nextState;
}

async function handleToggleAutoPilot(enabled: boolean) {
  const state = await readState(browserName, extensionVersion);
  requirePairing(state);

  if (enabled && state.uiStatus === 'maintenance') {
    throw new Error('Auto Pilot is unavailable while the portal is under maintenance.');
  }

  if (enabled && getEffectiveRemainingSeconds(state) <= 0) {
    await handleSessionCreditExpired('auto_pilot_enable_guard');
    throw new Error('No study time remains for this session.');
  }

  if (enabled) {
    // Store the current active tab as the autopilot target — this lets Full Auto
    // keep working even when the user switches to another tab.
    try {
      const tab = await getActiveTab();
      autoPilotTabId = tab?.id ?? null;
    } catch {
      autoPilotTabId = null;
    }
  } else {
    autoPilotTabId = null; // Clear when disabling
  }

  const nextState = await updateState(
    (current) =>
      appendNotice(
        appendRecentAction(
          {
            ...current,
            autoPilotEnabled: enabled,
            autoClickEnabled: enabled ? true : current.autoClickEnabled,
          },
          enabled ? 'Enable Auto Pilot' : 'Disable Auto Pilot',
        ),
        {
          tone: enabled ? 'success' : 'info',
          title: enabled ? 'Auto Pilot engaged' : 'Auto Pilot stopped',
          message: enabled
            ? 'The extension will now automatically analyze, select answers, and jump to the next page until finished.'
            : 'Auto Pilot cycle has standard control restored.',
        },
      ),
    browserName,
    extensionVersion,
  );

  if (enabled && autoPilotTabId) {
    try {
      const tab = await chrome.tabs.get(autoPilotTabId);
      if (tab?.url) {
        await ensureTabHostPermission(tab.url);
        await injectExtractor(autoPilotTabId);
        await chrome.tabs.sendMessage(autoPilotTabId, {
          type: 'EXTENSION/SET_LIVE_ASSIST',
          payload: { enabled: true },
        }).catch(() => { });
      }
    } catch {
      // Tab may have been closed
    }
  }

  return nextState;
}

async function handleAutoClickAll() {
  const state = await readState(browserName, extensionVersion);
  requirePairing(state);

  if (state.uiStatus === 'maintenance') {
    throw new Error('Auto-click is unavailable while the portal is under maintenance.');
  }

  if (getEffectiveRemainingSeconds(state) <= 0) {
    await handleSessionCreditExpired('auto_click_guard');
    throw new Error('No study time remains for this session.');
  }

  if (state.lastSuggestion.questionSuggestions.length === 0) {
    throw new Error('No suggestions available. Analyze the page first.');
  }

  return performAutoClickAll(state);
}

async function sendAutoClickAnswerMessage(tabId: number, suggestion: ExtensionQuestionSuggestion) {
  return chrome.tabs.sendMessage(tabId, {
    type: 'EXTENSION/AUTO_CLICK_ANSWER',
    payload: {
      questionId: suggestion.questionId,
      answerText: suggestion.answerText ?? '',
      suggestedOption: suggestion.suggestedOption,
      options: [],
    } satisfies AutoClickAnswerPayload,
  }) as Promise<ExtensionResponse<AutoClickResult>>;
}

async function attemptAutoClickSuggestion(
  tabId: number,
  suggestion: ExtensionQuestionSuggestion,
): Promise<ExtensionResponse<AutoClickResult> | null> {
  try {
    let response = await sendAutoClickAnswerMessage(tabId, suggestion);

    if (!response?.ok || !response.data?.clicked) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await injectExtractor(tabId);
      response = await sendAutoClickAnswerMessage(tabId, suggestion);
    }

    return response;
  } catch {
    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await injectExtractor(tabId);
      return await sendAutoClickAnswerMessage(tabId, suggestion);
    } catch {
      return null;
    }
  }
}

async function performAutoClickAll(state: ExtensionState) {
  // Use stored auto-pilot tab for background tab support, fallback to active tab
  let tabId: number;
  if (autoPilotTabId) {
    tabId = autoPilotTabId;
  } else {
    const tab = await getActiveTab();
    tabId = tab.id!;
  }
  await injectExtractor(tabId);

  const suggestions = state.lastSuggestion.questionSuggestions;
  let clickedCount = 0;
  let failedCount = 0;
  let blockingFailures = 0;
  let usedTextEntry = false;

  const updatedSuggestions: ExtensionQuestionSuggestion[] = [];

  for (let i = 0; i < suggestions.length; i++) {
    const liveState = await readState(browserName, extensionVersion);
    if (liveState.uiStatus === 'maintenance') {
      break;
    }

    if (getEffectiveRemainingSeconds(liveState) <= 0) {
      await handleSessionCreditExpired('auto_click_loop');
      break;
    }

    const suggestion = suggestions[i]!;
    const answer = suggestion.suggestedOption ?? suggestion.answerText;

    if (!answer || suggestion.sourceScope === 'no_match') {
      updatedSuggestions.push({
        ...suggestion,
        answerText: suggestion.answerText ?? null,
        suggestedOption: suggestion.suggestedOption ?? null,
        shortExplanation: suggestion.shortExplanation ?? null,
        confidence: suggestion.confidence ?? null,
        warning: suggestion.warning ?? null,
        matchedSubject: suggestion.matchedSubject ?? null,
        matchedCategory: suggestion.matchedCategory ?? null,
        sourceScope: suggestion.sourceScope ?? 'no_match',
        clickStatus: 'no_match' as const,
        clickedText: null,
      });
      failedCount++;
      continue;
    }

    try {
      const response = await attemptAutoClickSuggestion(tabId, suggestion);

      if (response?.ok && response.data?.clicked) {
        if (response.data.matchMethod === 'fill_in_blank' || response.data.matchMethod === 'dropdown_select') {
          usedTextEntry = true;
        }

        updatedSuggestions.push({
          ...suggestion,
          answerText: suggestion.answerText ?? null,
          suggestedOption: suggestion.suggestedOption ?? null,
          shortExplanation: suggestion.shortExplanation ?? null,
          confidence: suggestion.confidence ?? null,
          warning: suggestion.warning ?? null,
          matchedSubject: suggestion.matchedSubject ?? null,
          matchedCategory: suggestion.matchedCategory ?? null,
          sourceScope: suggestion.sourceScope ?? 'no_match',
          clickStatus: 'clicked' as const,
          clickedText: response.data.clickedText,
        });
        clickedCount++;
      } else {
        blockingFailures++;
        updatedSuggestions.push({
          ...suggestion,
          answerText: suggestion.answerText ?? null,
          suggestedOption: suggestion.suggestedOption ?? null,
          shortExplanation: suggestion.shortExplanation ?? null,
          confidence: suggestion.confidence ?? null,
          warning: suggestion.warning ?? null,
          matchedSubject: suggestion.matchedSubject ?? null,
          matchedCategory: suggestion.matchedCategory ?? null,
          sourceScope: suggestion.sourceScope ?? 'no_match',
          clickStatus: 'suggested_only' as const,
          clickedText: null,
        });
        failedCount++;
      }
    } catch {
      blockingFailures++;
      updatedSuggestions.push({
        ...suggestion,
        answerText: suggestion.answerText ?? null,
        suggestedOption: suggestion.suggestedOption ?? null,
        shortExplanation: suggestion.shortExplanation ?? null,
        confidence: suggestion.confidence ?? null,
        warning: suggestion.warning ?? null,
        matchedSubject: suggestion.matchedSubject ?? null,
        matchedCategory: suggestion.matchedCategory ?? null,
        sourceScope: suggestion.sourceScope ?? 'no_match',
        clickStatus: 'skipped' as const,
        clickedText: null,
      });
      failedCount++;
    }

    // Small delay between clicks to avoid overwhelming the page
    if (i < suggestions.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  const finalState = await updateState(
    (current) =>
      appendNotice(
        appendRecentAction(
          {
            ...current,
            lastSuggestion: {
              ...current.lastSuggestion,
              questionSuggestions: updatedSuggestions,
            },
          },
          `Auto-Click: ${clickedCount}/${suggestions.length}`,
        ),
        {
          tone: clickedCount > 0 ? 'success' : 'warning',
          title: 'Auto-click complete',
          message:
            clickedCount === suggestions.length
              ? `All ${clickedCount} answers were automatically selected! ✅`
              : `Clicked ${clickedCount} of ${suggestions.length} answers. ${failedCount} could not be matched on the page.`,
        },
      ),
    browserName,
    extensionVersion,
  );

  // In Full Auto mode, ALWAYS proceed to the next page regardless of click success.
  // The user wants Auto Pilot to skip no-match / failed questions and keep going
  // until it reaches "Finish attempt" (last question).
  if (finalState.autoPilotEnabled && finalState.session.status === 'session_active') {
    // Wait briefly, then attempt to click Next Page
    setTimeout(async () => {
      try {
        // Re-check auto pilot is still enabled before proceeding
        const currentState = await readState(browserName, extensionVersion);
        if (!currentState.autoPilotEnabled || currentState.session.status !== 'session_active') {
          return;
        }

        // Check if credits are still available
        if (currentState.uiStatus === 'maintenance') {
          await handleToggleAutoPilot(false);
          return;
        }

        if (getEffectiveRemainingSeconds(currentState) <= 0) {
          await handleSessionCreditExpired('auto_pilot_next_page');
          return;
        }

        const response = (await chrome.tabs.sendMessage(tabId, {
          type: 'EXTENSION/AUTO_CLICK_NEXT_PAGE',
        })) as ExtensionResponse<{ clicked: boolean; isLastPage?: boolean }>;

        if (response?.ok && response.data?.clicked) {
          if (response.data.isLastPage) {
            // We just clicked "Finish attempt", mark the quiz as done
            await updateState(
              (current) =>
                appendNotice(
                  {
                    ...current,
                    autoPilotEnabled: false,
                    uiStatus: 'suggestion_ready',
                  },
                  {
                    tone: 'success',
                    title: '✅ Done Answering!',
                    message: 'All questions have been processed. Auto Pilot has reached the end of the quiz and stopped automatically.',
                  },
                ),
              browserName,
              extensionVersion,
            );
          }
          return;
        }

        if (!response?.ok || !response.data?.clicked) {
          // No next button found — this might be the last page or a multi-question page
          // Don't disable auto pilot, just stop the cycle gracefully
          await updateState(
            (current) =>
              appendNotice(current, {
                tone: 'info',
                title: 'Auto Pilot paused',
                message: 'No next page button found. Auto Pilot will resume if the page changes.',
              }),
            browserName,
            extensionVersion,
          );
        }
      } catch (error) {
        // Non-fatal: don't disable auto pilot on transient errors
        console.error('Auto Pilot next page error:', error);
      }
    }, usedTextEntry ? 1800 : 800);
  }

  return finalState;
}

async function handleToggleLiveAssist(enabled: boolean) {
  const state = await readState(browserName, extensionVersion);
  requirePairing(state);

  if (enabled && state.uiStatus === 'maintenance') {
    throw new Error('Live Assist is unavailable while the portal is under maintenance.');
  }

  if (enabled && getEffectiveRemainingSeconds(state) <= 0) {
    await handleSessionCreditExpired('live_assist_enable_guard');
    throw new Error('No study time remains for this session.');
  }

  const tab = await getActiveTab();
  if (enabled) {
    await ensureTabHostPermission(tab.url!);
  }
  await injectExtractor(tab.id!);
  await chrome.tabs.sendMessage(tab.id!, {
    type: 'EXTENSION/SET_LIVE_ASSIST',
    payload: { enabled },
  });

  const nextState = await updateState(
    (current) =>
      appendNotice(
        appendRecentAction(
          {
            ...current,
            session: {
              ...current.session,
              liveAssistEnabled: enabled,
            },
          },
          enabled ? 'Enable Live Assist' : 'Disable Live Assist',
        ),
        {
          tone: enabled ? 'info' : 'warning',
          title: enabled ? 'Live Assist enabled' : 'Live Assist paused',
          message: enabled
            ? `Meaningful page changes on ${new URL(tab.url!).hostname} will trigger throttled re-analysis.`
            : 'Automatic change detection has been stopped.',
        },
      ),
    browserName,
    extensionVersion,
  );

  return nextState;
}

async function handleManualOverride(payload: ManualOverridePayload) {
  const nextState = await updateState(
    (current) =>
      appendRecentAction(
        {
          ...current,
          session: {
            ...current.session,
            detectionMode: payload.subject || payload.category ? 'manual' : 'auto',
            manualSubject: payload.subject,
            manualCategory: payload.category,
          },
        },
        'Confirm Manual Override',
      ),
    browserName,
    extensionVersion,
  );

  return nextState;
}

async function handleRefreshCredits() {
  const wallet = await withAuthRetry((state) => refreshWallet(state));
  const nextState = await updateState(
    (current) =>
      appendRecentAction(
        (() => {
          const nextSnapshot = {
            ...current,
            creditsRemainingSeconds: wallet.remainingSeconds,
            sessionCreditExpiresAt: buildSessionExpiry(
              wallet.remainingSeconds,
              current.session.status === 'session_active',
            ),
          };

          return {
            ...nextSnapshot,
            uiStatus: wallet.remainingSeconds > 0 ? computeUiStatus(nextSnapshot, 'ready') : 'no_credits',
          };
        })(),
        'Refresh Credits',
      ),
    browserName,
    extensionVersion,
  );

  await syncSessionExpiryAlarm(nextState);

  if (wallet.remainingSeconds <= 0 && nextState.session.status === 'session_active') {
    await handleSessionCreditExpired('manual_refresh');
    return readState(browserName, extensionVersion);
  }

  return nextState;
}

async function handleOpenDashboard() {
  const state = await readState(browserName, extensionVersion);
  await openDashboard(state.appBaseUrl, state.pairingStatus === 'paired' ? '/dashboard' : '');
  return true;
}

async function handleReportWrongDetection() {
  const state = await readState(browserName, extensionVersion);
  await openDashboard(state.appBaseUrl, '/usage-logs?report=wrong-detection');

  const nextState = await updateState(
    (current) =>
      appendNotice(
        appendRecentAction(current, 'Report Wrong Detection'),
        {
          tone: 'warning',
          title: 'Review opened in dashboard',
          message: 'Use the dashboard to review the latest attempt and submit a support note for the incorrect routing.',
        },
      ),
    browserName,
    extensionVersion,
  );

  return nextState;
}

async function handleLiveAssistSignal(tabId: number | undefined, payload: LiveAssistSignalPayload) {
  if (!tabId) {
    return false;
  }

  const state = await readState(browserName, extensionVersion);
  if (state.uiStatus === 'maintenance') {
    return false;
  }

  if (getEffectiveRemainingSeconds(state) <= 0) {
    await handleSessionCreditExpired('live_assist_signal_guard');
    return false;
  }

  if (!state.session.liveAssistEnabled || state.session.status !== 'session_active' || state.autoPilotEnabled || currentAnalyzeController) {
    return false;
  }

  const existingTimer = liveAssistTimers.get(tabId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = self.setTimeout(async () => {
    liveAssistTimers.delete(tabId);
    try {
      await handleAnalyze({ mode: 'analyze', includeScreenshot: false });
    } catch (error) {
      await recordError(error instanceof Error ? error.message : `Live Assist failed for ${payload.pageTitle}.`);
    }
  }, 2500);

  liveAssistTimers.set(tabId, timer);
  return true;
}

// ─── Periodic alarms: credit refresh + idle check ───────────────────────────

async function startPeriodicAlarms() {
  // Refresh credits every 60 seconds so admin/portal top-ups appear live
  await chrome.alarms.create(CREDIT_REFRESH_ALARM, {
    periodInMinutes: 1,
  });
  // Check for idle every 2 minutes
  await chrome.alarms.create(IDLE_CHECK_ALARM, {
    periodInMinutes: 2,
  });
}

async function stopPeriodicAlarms() {
  await chrome.alarms.clear(CREDIT_REFRESH_ALARM);
  await chrome.alarms.clear(IDLE_CHECK_ALARM);
}

async function handlePeriodicCreditRefresh() {
  try {
    const state = await readState(browserName, extensionVersion);
    if (state.pairingStatus !== 'paired' || state.session.status !== 'session_active') {
      await stopPeriodicAlarms();
      return;
    }

    const wallet = await withAuthRetry((s) => refreshWallet(s));

    await updateState(
      (current) => {
        const nextSnapshot = {
          ...current,
          creditsRemainingSeconds: wallet.remainingSeconds,
          sessionCreditExpiresAt: buildSessionExpiry(
            wallet.remainingSeconds,
            current.session.status === 'session_active',
          ),
        };

        return {
          ...nextSnapshot,
          uiStatus: wallet.remainingSeconds > 0 ? computeUiStatus(nextSnapshot, 'ready') : 'no_credits',
        };
      },
      browserName,
      extensionVersion,
    );

    if (wallet.remainingSeconds <= 0) {
      await handleSessionCreditExpired('periodic_refresh');
    }
  } catch (error) {
    // Silent failure — don't spam the activity log with periodic refresh errors
    console.warn('Periodic credit refresh failed:', error);
  }
}

async function handleIdleCheck() {
  try {
    const state = await readState(browserName, extensionVersion);

    // Only check idle for active sessions
    if (state.session.status !== 'session_active') {
      await stopPeriodicAlarms();
      return;
    }

    const lastActivity = state.session.lastActivityAt;
    if (!lastActivity) {
      return;
    }

    const idleMs = Date.now() - new Date(lastActivity).getTime();

    if (idleMs >= IDLE_AUTO_END_MS) {
      // Auto-end the session after 10 minutes of inactivity
      try {
        await withAuthRetry((current) => endSession(current));
      } catch {
        // Server session might already be ended — that's fine
      }

      const nextState = await updateState(
        (current) =>
          appendNotice(
            appendRecentAction(
              {
                ...current,
                sessionCreditExpiresAt: null,
                autoPilotEnabled: false,
                autoClickEnabled: false,
                session: {
                  ...current.session,
                  sessionId: null,
                  status: 'session_inactive',
                  liveAssistEnabled: false,
                },
                uiStatus: computeUiStatus(current, 'ready'),
              },
              'Auto-End (Idle)',
            ),
            {
              tone: 'info',
              title: 'Session auto-ended',
              message: 'No activity for 10 minutes. Session was ended automatically to save your credits.',
            },
          ),
        browserName,
        extensionVersion,
      );

      await stopPeriodicAlarms();
      await syncSessionExpiryAlarm(nextState);
    }
  } catch (error) {
    console.warn('Idle check failed:', error);
  }
}

async function withAuthRetry<T>(operation: (state: ExtensionState) => Promise<T>): Promise<T> {
  let state = await readState(browserName, extensionVersion);
  requirePairing(state);

  try {
    return await operation(state);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !state.refreshToken) {
      throw error;
    }

    state = await refreshAuthStateWithLock();
    return operation(state);
  }
}

async function refreshAuthStateWithLock(): Promise<ExtensionState> {
  if (!currentTokenRefreshPromise) {
    currentTokenRefreshPromise = (async () => {
      const latestState = await readState(browserName, extensionVersion);
      requirePairing(latestState);

      const refreshed = await refreshExtensionToken(latestState);
      await updateState(
        (current) => ({
          ...current,
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken ?? current.refreshToken,
        }),
        browserName,
        extensionVersion,
      );

      return readState(browserName, extensionVersion);
    })().finally(() => {
      currentTokenRefreshPromise = null;
    });
  }

  return currentTokenRefreshPromise;
}
