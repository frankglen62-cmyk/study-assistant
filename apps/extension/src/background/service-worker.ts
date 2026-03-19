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
  pauseSession,
  refreshExtensionToken,
  refreshWallet,
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
const liveAssistTimers = new Map<number, number>();
let currentAnalyzeController: AbortController | null = null;

void initializeRuntime();

chrome.runtime.onInstalled.addListener(async (details) => {
  await initializeRuntime();

  if (details.reason === 'install') {
    await chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await initializeRuntime();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    void (async () => {
      try {
        const state = await readState(browserName, extensionVersion);
        if (state.autoPilotEnabled && state.session.status === 'session_active') {
          // Make sure this tab is currently the active one to avoid background execution
          const activeTab = await getActiveTab();
          if (activeTab?.id !== tabId) return;

          // Add a small delay to let SPA routers settle, then analyze with auto-retry
          setTimeout(async () => {
            try {
              // Re-check active tab just before running
              const currentActive = await getActiveTab();
              if (currentActive?.id === tabId) {
                await analyzeWithAutoRetry(3, 7000);
              }
            } catch (err) {
              console.error('Auto Pilot analysis failed on new page load:', err);
            }
          }, 1500);
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

  const current = await readState(browserName, extensionVersion);
  if (!current.browserName || !current.extensionVersion) {
    await writeState(createDefaultState(browserName, extensionVersion));
  }
}

function success<T>(data: T): ExtensionResponse<T> {
  return { ok: true, data };
}

function failure(error: string): ExtensionResponse {
  return { ok: false, error };
}

async function recordError(error: string): Promise<void> {
  await updateState(
    (current) =>
      appendNotice(
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
      ),
    browserName,
    extensionVersion,
  );
}

async function handleExtensionFailure(error: unknown): Promise<string> {
  if (error instanceof ApiError) {
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
      await updateState(
        (current) =>
          appendNotice(
            {
              ...current,
              uiStatus: 'no_credits',
              creditsRemainingSeconds: 0,
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

      return error.message;
    }

    if (error.status === 403 && error.code === 'wallet_locked') {
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
              title: 'Wallet locked',
              message: error.message,
            },
          ),
        browserName,
        extensionVersion,
      );

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
  if (state.pairingStatus !== 'paired') {
    return 'not_connected';
  }

  if (state.creditsRemainingSeconds === 0) {
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

  return nextState;
}

async function handleSessionMutation(mode: 'start' | 'pause' | 'resume' | 'end') {
  const response = await withAuthRetry((state) =>
    mode === 'start'
      ? startSession(state)
      : mode === 'pause'
        ? pauseSession(state)
        : mode === 'resume'
          ? resumeSession(state)
          : endSession(state),
  );

  const statusMap = {
    start: 'session_active',
    pause: 'session_paused',
    resume: 'session_active',
    end: 'session_inactive',
  } as const;

  const actionMap = {
    start: 'Start Session',
    pause: 'Pause Session',
    resume: 'Resume Session',
    end: 'End Session',
  } as const;

  const nextState = await updateState(
    (current) => {
      const remainingSeconds = response.remainingSeconds ?? current.creditsRemainingSeconds;

      return appendRecentAction(
        {
          ...current,
          uiStatus: computeUiStatus(
            {
              ...current,
              creditsRemainingSeconds: remainingSeconds,
            },
            'ready',
          ),
          creditsRemainingSeconds: remainingSeconds,
          session: {
            ...current.session,
            sessionId: mode === 'end' ? null : response.sessionId,
            status: statusMap[mode],
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

async function collectCurrentPageContext(includeScreenshot: boolean) {
  const tab = await getActiveTab();
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
        uiStatus: 'suggestion_ready', // Revert to ready state
        lastError: 'Answer search was cancelled by user.',
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
async function analyzeWithAutoRetry(maxAttempts: number = 3, timeoutMs: number = 5000) {
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
        console.warn(`Auto Pilot: Analysis attempt ${attempt}/${maxAttempts} timed out after ${timeoutMs}ms, ${attempt < maxAttempts ? 'retrying...' : 'giving up.'}`);
        
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
      throw error; // Final attempt failed, rethrow
    }
  }
}

async function handleAnalyze(payload: AnalyzeCurrentPagePayload) {
  let state = await readState(browserName, extensionVersion);
  requirePairing(state);

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
    const currentContext = await collectCurrentPageContext(payload.includeScreenshot ?? false);
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
  currentAnalyzeController = new AbortController();

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
        signal: currentAnalyzeController?.signal,
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
    if (currentAnalyzeController && !currentAnalyzeController.signal.aborted) {
      currentAnalyzeController = null; // Clean up
    }
  }

  const creditsRemainingSeconds = response.remainingSeconds ?? state.creditsRemainingSeconds;
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
              `${response.detectedSubject ?? response.subject ?? 'Unknown subject'}${
                response.sourceSubject && response.sourceSubject !== response.detectedSubject
                  ? ` -> ${response.sourceSubject}`
                  : ''
              } ${
                response.confidence !== null ? `at ${Math.round(response.confidence * 100)}% confidence` : ''
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
    setTimeout(async () => {
      try {
        const currentState = await readState(browserName, extensionVersion);
        if (!currentState.autoPilotEnabled || currentState.session.status !== 'session_active') {
          return;
        }
        if (currentState.creditsRemainingSeconds <= 0) {
          await handleToggleAutoPilot(false);
          return;
        }
        const tab = await getActiveTab();
        if (!tab?.id) return;
        await injectExtractor(tab.id);
        const response = (await chrome.tabs.sendMessage(tab.id, {
          type: 'EXTENSION/AUTO_CLICK_NEXT_PAGE',
        })) as ExtensionResponse<{ clicked: boolean }>;

        if (!response?.ok || !response.data?.clicked) {
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
        console.error('Auto Pilot next page (no match) error:', error);
      }
    }, 800);
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
      }).catch(() => {});
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

  const nextState = await updateState(
    (current) =>
      appendNotice(
        appendRecentAction(
          {
            ...current,
            autoPilotEnabled: enabled,
            autoClickEnabled: enabled ? true : current.autoClickEnabled,
            session: {
              ...current.session,
              liveAssistEnabled: enabled ? true : current.session.liveAssistEnabled,
            },
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

  if (enabled) {
    const tab = await getActiveTab();
    if (tab?.id && tab.url) {
      await ensureTabHostPermission(tab.url);
      await injectExtractor(tab.id);
      await chrome.tabs.sendMessage(tab.id, {
        type: 'EXTENSION/SET_LIVE_ASSIST',
        payload: { enabled: true },
      }).catch(() => {});
    }
  }

  return nextState;
}

async function handleAutoClickAll() {
  const state = await readState(browserName, extensionVersion);
  requirePairing(state);

  if (state.lastSuggestion.questionSuggestions.length === 0) {
    throw new Error('No suggestions available. Analyze the page first.');
  }

  return performAutoClickAll(state);
}

async function performAutoClickAll(state: ExtensionState) {
  const tab = await getActiveTab();
  await injectExtractor(tab.id!);

  const suggestions = state.lastSuggestion.questionSuggestions;
  let clickedCount = 0;
  let failedCount = 0;

  const updatedSuggestions: ExtensionQuestionSuggestion[] = [];

  for (let i = 0; i < suggestions.length; i++) {
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
      const response = (await chrome.tabs.sendMessage(tab.id!, {
        type: 'EXTENSION/AUTO_CLICK_ANSWER',
        payload: {
          questionId: suggestion.questionId,
          answerText: suggestion.answerText ?? '',
          suggestedOption: suggestion.suggestedOption,
          options: [],
        } satisfies AutoClickAnswerPayload,
      })) as ExtensionResponse<AutoClickResult>;

      if (response?.ok && response.data?.clicked) {
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
        if (currentState.creditsRemainingSeconds <= 0) {
          await handleToggleAutoPilot(false);
          return;
        }

        const response = (await chrome.tabs.sendMessage(tab.id!, {
          type: 'EXTENSION/AUTO_CLICK_NEXT_PAGE',
        })) as ExtensionResponse<{ clicked: boolean }>;

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
    }, 800);
  }

  return finalState;
}

async function handleToggleLiveAssist(enabled: boolean) {
  const state = await readState(browserName, extensionVersion);
  requirePairing(state);

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
  if (!state.session.liveAssistEnabled || state.session.status !== 'session_active') {
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

async function withAuthRetry<T>(operation: (state: ExtensionState) => Promise<T>): Promise<T> {
  let state = await readState(browserName, extensionVersion);
  requirePairing(state);

  try {
    return await operation(state);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !state.refreshToken) {
      throw error;
    }

    const refreshed = await refreshExtensionToken(state);
    await updateState(
      (current) => ({
        ...current,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? current.refreshToken,
      }),
      browserName,
      extensionVersion,
    );

    state = await readState(browserName, extensionVersion);
    return operation(state);
  }
}
