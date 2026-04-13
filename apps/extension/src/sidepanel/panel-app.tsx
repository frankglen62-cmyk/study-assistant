import { useEffect, useState, useCallback, useRef } from 'react';

import { confidenceToLevel, formatConfidence, formatDurationDetailed, normalizeAppUrl, normalizeOriginPattern } from '@study-assistant/shared-utils';
import type { ExtensionState, ExtensionQuestionSuggestion } from '@study-assistant/shared-types';

import type { AnalyzeCurrentPagePayload, ManualOverridePayload, PairExtensionPayload } from '../lib/messages';
import { getStoredExtensionState, sendExtensionMessage, subscribeToExtensionState } from '../lib/runtime';
import { SectionCard } from './components/section-card';
import { SessionStatusPill, UiStatusPill } from './components/status-pill';
import {
  getSubjectDisplayLabel,
  getSubjectSuggestions,
  type SubjectCatalogEntry,
} from './subject-picker';
import {
  Zap, WifiOff, FileSearch, Sparkles, MousePointerClick,
  RefreshCw, XCircle, LayoutDashboard, Copy, Lock, Unlock, Globe,
  ChevronDown, ChevronRight, BookOpen, Search, Loader2, CheckCircle2, Info, Target, Play,
  RotateCcw, BotMessageSquare, ListChecks, AlertTriangle, Link2, ShieldCheck, BadgeCheck, Share2, ArrowLeft, Clock, Pause, Square,
  Moon, Sun,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Site access types                                                   */
/* ------------------------------------------------------------------ */
type SiteAccessStatus = 'granted' | 'not_granted' | 'unsupported_page' | 'no_tab';

interface SiteAccessResult {
  status: SiteAccessStatus;
  host: string;
  origin: string;
  tabUrl: string;
}

function getEffectiveRemainingSeconds(state: ExtensionState | null) {
  if (!state) {
    return 0;
  }

  if (state.session.status === 'session_active' && state.sessionCreditExpiresAt) {
    const expiresAt = new Date(state.sessionCreditExpiresAt).getTime();

    if (Number.isFinite(expiresAt)) {
      return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    }
  }

  return Math.max(0, state.creditsRemainingSeconds);
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */
function useExtensionState() {
  const [state, setState] = useState<ExtensionState | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const stored = await getStoredExtensionState();
      if (stored && active) {
        setState(stored);
        return;
      }

      const response = await sendExtensionMessage<ExtensionState>({ type: 'EXTENSION/GET_STATE' });
      if (response.ok && response.data && active) {
        setState(response.data);
      }
    })();

    const unsubscribe = subscribeToExtensionState((nextState) => {
      if (active) {
        setState(nextState);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}

function useSiteAccess(isPaired: boolean) {
  const [access, setAccess] = useState<SiteAccessResult | null>(null);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const response = await sendExtensionMessage<SiteAccessResult>({ type: 'EXTENSION/CHECK_SITE_ACCESS' });
      if (response.ok && response.data) {
        setAccess(response.data);
      }
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (isPaired) {
      void refresh();
    }
  }, [isPaired, refresh]);

  useEffect(() => {
    if (!isPaired) return;

    const onTabActivated = () => void refresh();
    const onTabUpdated = (_tabId: number, changeInfo: { status?: string }) => {
      if (changeInfo.status === 'complete') {
        void refresh();
      }
    };

    chrome.tabs.onActivated.addListener(onTabActivated);
    chrome.tabs.onUpdated.addListener(onTabUpdated);

    return () => {
      chrome.tabs.onActivated.removeListener(onTabActivated);
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
    };
  }, [isPaired, refresh]);

  return { access, checking, refresh };
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */
function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  const level = confidenceToLevel(confidence);
  const label = confidence !== null ? formatConfidence(confidence) : 'N/A';
  return <span className={`confidence-badge confidence-badge--${level}`}>{label}</span>;
}

function AutoClickStatusBadge({ status }: { status: ExtensionQuestionSuggestion['clickStatus'] }) {
  if (status === 'pending') {
    return <span className="status-badge status-badge--pending"><Loader2 size={10} className="animate-spin" /> Pending</span>;
  }
  if (status === 'clicked') {
    return <span className="status-badge status-badge--success"><MousePointerClick size={10} /> Clicked</span>;
  }
  if (status === 'suggested_only') {
    return <span className="status-badge status-badge--info"><Target size={10} /> Suggested</span>;
  }
  if (status === 'no_match' || status === 'skipped') {
    return <span className="status-badge status-badge--warning"><XCircle size={10} /> Skipped</span>;
  }
  return null;
}

function AnalyzeProgressBar() {
  return (
    <div className="analyze-progress">
      <div className="analyze-progress__bar">
        <div className="analyze-progress__fill" />
      </div>
      <div className="analyze-progress__text">
        <Loader2 size={14} className="animate-spin" />
        <span>Searching sources & matching answers…</span>
      </div>
    </div>
  );
}

function QuestionResultCard({ suggestion, index }: {
  suggestion: ExtensionQuestionSuggestion;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const level = confidenceToLevel(suggestion.confidence);
  const hasAnswer = suggestion.suggestedOption || suggestion.answerText;
  const answer = suggestion.suggestedOption ?? suggestion.answerText ?? 'No match — skipped';

  return (
    <article className={`result-card result-card--${hasAnswer ? level : 'skipped'}`} style={{ animationDelay: `${index * 20}ms` }}>
      <button
        className="result-card__header"
        onClick={() => setExpanded((v) => !v)}
        type="button"
      >
        <div className="result-card__header-left">
          <span className="result-card__number">Q{index + 1}</span>
          <span className="result-card__prompt-preview">
            {suggestion.questionText.length > 55
              ? suggestion.questionText.slice(0, 55) + '…'
              : suggestion.questionText}
          </span>
        </div>
        <div className="result-card__header-right">
          <ConfidenceBadge confidence={suggestion.confidence} />
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
      </button>

      <div className={`result-card__answer-highlight ${!hasAnswer ? 'result-card__answer-highlight--skipped' : ''}`}>
        {hasAnswer
          ? <CheckCircle2 size={14} style={{ color: 'var(--sa-green)', flexShrink: 0, marginTop: 2 }} />
          : <XCircle size={14} style={{ color: 'var(--sa-muted)', flexShrink: 0, marginTop: 2 }} />
        }
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="result-card__answer-text">{answer}</span>
          {suggestion.clickStatus !== 'pending' && <AutoClickStatusBadge status={suggestion.clickStatus} />}
        </div>
      </div>

      {expanded && (
        <div className="result-card__body">
          <div className="result-card__field">
            <span className="result-card__label">Full Question</span>
            <p className="result-card__value">{suggestion.questionText}</p>
          </div>

          {suggestion.shortExplanation && (
            <div className="result-card__field">
              <span className="result-card__label">Explanation</span>
              <p className="result-card__value">{suggestion.shortExplanation}</p>
            </div>
          )}

          <div className="result-card__source-row">
            <div className="result-card__source-pill">
              <BookOpen size={10} />
              <span>{suggestion.matchedSubject ?? 'Unknown'}</span>
            </div>
            <div className="result-card__source-pill">
              <span>
                {suggestion.sourceScope === 'subject_folder'
                  ? 'Subject folder'
                  : suggestion.sourceScope === 'all_subject_folders'
                    ? 'Cross-subject'
                    : suggestion.sourceScope === 'file_sources'
                      ? 'File sources'
                      : 'No match'}
              </span>
            </div>
          </div>

          {suggestion.warning && (
            <div className="result-card__warning">
              <AlertTriangle size={11} />
              <span>{suggestion.warning}</span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export function SidePanelApp() {
  const state = useExtensionState();
  const [overrideDraft, setOverrideDraft] = useState<ManualOverridePayload>({ subject: '', category: '' });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [siteAccessMessage, setSiteAccessMessage] = useState<string | null>(null);
  const [availableSubjects, setAvailableSubjects] = useState<SubjectCatalogEntry[]>([]);
  const [subjectMode, setSubjectMode] = useState<'auto' | 'picker'>('auto');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [subjectsLastSyncedAt, setSubjectsLastSyncedAt] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<'controls' | 'answering'>('controls');
  const subjectsLoadingRef = useRef(false);
  const [displayRemainingSeconds, setDisplayRemainingSeconds] = useState(0);
  const [appBaseUrl, setAppBaseUrl] = useState('https://study-assistant-web.vercel.app');
  const [pairingCode, setPairingCode] = useState('');
  const [deviceName, setDeviceName] = useState('My Study Device');
  const [pairingFeedback, setPairingFeedback] = useState<{ tone: 'info' | 'success' | 'warning' | 'danger'; message: string } | null>({
    tone: 'info',
    message: 'Enter your portal URL, request connection permission, then paste the short-lived pairing code.',
  });
  const [pairingJustCompleted, setPairingJustCompleted] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const isPaired = state?.pairingStatus === 'paired';
  const { access, checking: accessChecking, refresh: refreshAccess } = useSiteAccess(Boolean(isPaired));

  // ─── Theme persistence via chrome.storage ───
  useEffect(() => {
    chrome.storage.local.get(['sa_theme'], (result) => {
      const savedTheme = result.sa_theme as 'dark' | 'light' | undefined;
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      }
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    chrome.storage.local.set({ sa_theme: theme });
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  useEffect(() => {
    if (!state) return;

    if (state.appBaseUrl) {
      setAppBaseUrl(state.appBaseUrl);
    }

    if (state.deviceName) {
      setDeviceName(state.deviceName);
    }

    setOverrideDraft({
      subject: state.session.manualSubject,
      category: state.session.manualCategory,
    });
    setSubjectMode(state.session.manualSubject ? 'picker' : 'auto');
    setSubjectPickerOpen(Boolean(state.session.manualSubject));
    setDisplayRemainingSeconds(getEffectiveRemainingSeconds(state));
  }, [
    state?.appBaseUrl,
    state?.creditsRemainingSeconds,
    state?.deviceName,
    state?.session.status,
    state?.sessionCreditExpiresAt,
    state?.session.manualCategory,
    state?.session.manualSubject,
  ]);

  useEffect(() => {
    if (!pairingJustCompleted) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPairingJustCompleted(false);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pairingJustCompleted]);

  useEffect(() => {
    if (access?.status === 'granted' || access?.status === 'unsupported_page') {
      setSiteAccessMessage(null);
    }
  }, [access?.status]);

  useEffect(() => {
    if (!isPaired || !state) {
      setAvailableSubjects([]);
      setSubjectsError(null);
      return;
    }

    let active = true;
    setSubjectsLoading(true);
    setSubjectsError(null);

    sendExtensionMessage<{ subjects: SubjectCatalogEntry[]; categories: { id: string; name: string; subject_id: string | null }[] }>({
        type: 'EXTENSION/GET_SUBJECTS',
      })
      .then((response) => {
        if (!active) return;

        if (response.ok && response.data) {
          setAvailableSubjects(response.data.subjects ?? []);
          setSubjectsLastSyncedAt(new Date().toISOString());
          return;
        }

        setAvailableSubjects([]);
        setSubjectsError(response.error ?? 'Could not load the latest subject list from the portal.');
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          setAvailableSubjects([]);
          setSubjectsError('Could not load the latest subject list from the portal.');
        }
      })
      .finally(() => {
        if (active) {
          setSubjectsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isPaired, state?.accessToken, state?.appBaseUrl, state?.refreshToken]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setDisplayRemainingSeconds(getEffectiveRemainingSeconds(state ?? null));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [state]);

  useEffect(() => {
    if (!state || isPaired) {
      return;
    }

    if (state.pairingStatus === 'revoked') {
      setPairingFeedback({
        tone: 'warning',
        message: 'This browser was revoked from the portal. Request permission again and use a new pairing code to reconnect it.',
      });
      return;
    }

    setPairingFeedback((current) => current ?? {
      tone: 'info',
      message: 'Enter your portal URL, request connection permission, then paste the short-lived pairing code.',
    });
  }, [isPaired, state]);

  const detectedQuestionCount = state?.currentPage?.totalQuestionsDetected
    ?? state?.currentPage?.questionCandidates.length
    ?? (state?.currentPage?.questionText ? 1 : 0);
  const suggestions = state?.lastSuggestion.questionSuggestions ?? [];
  const hasSuggestion = Boolean(state?.lastSuggestion.answerText) || suggestions.length > 0;
  const isAnalyzing = state?.uiStatus === 'scanning_page' || state?.uiStatus === 'detecting_subject' || state?.uiStatus === 'searching_sources';

  const cachedSubject = state?.session.cachedSubjectName ?? null;
  const manualSubject = state?.session.manualSubject.trim() ?? '';
  const currentSubject =
    manualSubject
    || state?.lastSuggestion.detectedSubject
    || state?.lastSuggestion.subject
    || cachedSubject
    || 'Auto';
  const sourceSubject = state?.lastSuggestion.sourceSubject ?? state?.lastSuggestion.detectedSubject ?? 'No source yet';
  const quizTitle = state?.currentPage?.quizTitle ?? null;
  const quizNumber = state?.currentPage?.quizNumber ?? null;
  const effectiveRemainingSeconds = getEffectiveRemainingSeconds(state ?? null);
  const isMaintenanceMode = state?.uiStatus === 'maintenance';

  const siteAccessGranted = access?.status === 'granted';
  const canAnalyze = isPaired && state?.session.status === 'session_active' && siteAccessGranted && effectiveRemainingSeconds > 0 && !isMaintenanceMode;
  const isFullAutoOn = state?.autoPilotEnabled ?? false;
  const subjectSuggestions = getSubjectSuggestions(availableSubjects, subjectSearch, 100);
  const selectedSubjectEntry =
    availableSubjects.find((subject) => subject.name === overrideDraft.subject)
    ?? availableSubjects.find((subject) => subject.name === manualSubject)
    ?? null;
  const selectedSubjectLabel = selectedSubjectEntry ? getSubjectDisplayLabel(selectedSubjectEntry) : overrideDraft.subject || manualSubject || '';
  const activeSubjectSummary = manualSubject
    ? `Locked: ${manualSubject}`
    : cachedSubject
      ? `Detected: ${cachedSubject}`
      : 'Auto detect';

  const confidenceLevel = confidenceToLevel(state?.lastSuggestion.confidence ?? null);
  const subjectsSyncedLabel = subjectsLastSyncedAt
    ? new Date(subjectsLastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  useEffect(() => {
    if (!isPaired) {
      setWorkspaceView('controls');
      return;
    }

    if (isAnalyzing || hasSuggestion) {
      setWorkspaceView('answering');
    }
  }, [hasSuggestion, isAnalyzing, isPaired]);

  const currentPageUrl = state?.currentPage?.pageUrl;
  useEffect(() => {
    if (workspaceView === 'answering' && currentPageUrl) {
      void sendExtensionMessage({ type: 'EXTENSION/DETECT_FROM_PAGE' });
    }
  }, [currentPageUrl, workspaceView]);

  async function runAction(action: string, operation: () => Promise<void>) {
    setPendingAction(action);
    try { await operation(); } finally { setPendingAction(null); }
  }

  async function sendAnalyze(
    mode: AnalyzeCurrentPagePayload['mode'],
    source: AnalyzeCurrentPagePayload['source'] = 'current',
    searchScope: AnalyzeCurrentPagePayload['searchScope'] = 'subject_first',
  ) {
    await runAction(`${mode}:${source}`, async () => {
      await sendExtensionMessage({
        type: 'EXTENSION/ANALYZE_CURRENT_PAGE',
        payload: { mode, includeScreenshot: false, source, searchScope, forceRedetect: mode === 'detect' },
      });
    });
  }

  async function sendSimple(type:
    | 'EXTENSION/START_SESSION'
    | 'EXTENSION/PAUSE_SESSION'
    | 'EXTENSION/RESUME_SESSION'
    | 'EXTENSION/END_SESSION'
    | 'EXTENSION/REFRESH_CREDITS'
    | 'EXTENSION/OPEN_DASHBOARD'
    | 'EXTENSION/REPORT_WRONG_DETECTION'
    | 'EXTENSION/RESET_EXAM'
    | 'EXTENSION/CANCEL_ANALYZE') {
    await runAction(type, async () => {
      await sendExtensionMessage({ type });
    });
  }

  async function toggleFullAuto(enabled: boolean) {
    await runAction('EXTENSION/TOGGLE_AUTO_PILOT', async () => {
      await sendExtensionMessage({
        type: 'EXTENSION/TOGGLE_AUTO_PILOT',
        payload: { enabled },
      });
    });
  }

  async function triggerAutoClickAll() {
    await runAction('EXTENSION/AUTO_CLICK_ALL', async () => {
      await sendExtensionMessage({ type: 'EXTENSION/AUTO_CLICK_ALL' });
    });
  }

  async function confirmOverride() {
    await runAction('EXTENSION/SET_MANUAL_OVERRIDE', async () => {
      await sendExtensionMessage({
        type: 'EXTENSION/SET_MANUAL_OVERRIDE',
        payload: overrideDraft,
      });
    });
  }

  const refreshSubjectCatalog = useCallback(async () => {
    if (!isPaired || subjectsLoadingRef.current) return;

    subjectsLoadingRef.current = true;
    setSubjectsLoading(true);
    setSubjectsError(null);
    try {
      const response = await sendExtensionMessage<{ subjects: SubjectCatalogEntry[]; categories: { id: string; name: string; subject_id: string | null }[] }>({
        type: 'EXTENSION/GET_SUBJECTS',
      });
      if (response.ok && response.data) {
        setAvailableSubjects(response.data.subjects ?? []);
        setSubjectsLastSyncedAt(new Date().toISOString());
        return;
      }

      setAvailableSubjects([]);
      setSubjectsError(response.error ?? 'Could not refresh the subject list from the portal.');
    } catch (error) {
      console.error(error);
      setSubjectsError('Could not refresh the subject list from the portal.');
    } finally {
      subjectsLoadingRef.current = false;
      setSubjectsLoading(false);
    }
  }, [isPaired]);

  function chooseSubject(subject: SubjectCatalogEntry) {
    setOverrideDraft((current) => ({ ...current, subject: subject.name, category: '' }));
    setSubjectSearch(getSubjectDisplayLabel(subject));
    setSubjectPickerOpen(false);
  }

  function updateSubjectSearch(value: string) {
    setSubjectSearch(value);
    setSubjectPickerOpen(true);
    setOverrideDraft((current) => {
      const normalizedValue = value.trim().toLowerCase();
      if (!normalizedValue) {
        return current;
      }

      const exactMatch = availableSubjects.find((subject) => {
        const displayLabel = getSubjectDisplayLabel(subject).toLowerCase();
        return displayLabel === normalizedValue || subject.name.toLowerCase() === normalizedValue;
      });
      if (exactMatch) {
        return { ...current, subject: exactMatch.name, category: '' };
      }

      const currentDisplayLabel = selectedSubjectEntry ? getSubjectDisplayLabel(selectedSubjectEntry).toLowerCase() : '';
      if (
        current.subject &&
        normalizedValue !== current.subject.toLowerCase() &&
        normalizedValue !== currentDisplayLabel
      ) {
        return { ...current, subject: '', category: '' };
      }

      return current;
    });
  }

  async function enableAutoDetect() {
    setSubjectMode('auto');
    setSubjectSearch('');
    setSubjectPickerOpen(false);
    setOverrideDraft({ subject: '', category: '' });

    await runAction('EXTENSION/SET_MANUAL_OVERRIDE', async () => {
      await sendExtensionMessage({
        type: 'EXTENSION/SET_MANUAL_OVERRIDE',
        payload: { subject: '', category: '' },
      });
    });
  }

  async function applySelectedSubject() {
    if (!overrideDraft.subject) {
      return;
    }

    await confirmOverride();
    setSubjectPickerOpen(false);
    const nextSelectedSubject = availableSubjects.find((subject) => subject.name === overrideDraft.subject) ?? null;
    setSubjectSearch(nextSelectedSubject ? getSubjectDisplayLabel(nextSelectedSubject) : '');
    if (canAnalyze) {
      setWorkspaceView('answering');
    }
  }

  async function unpairBrowser() {
    if (!window.confirm('Unpair this browser from your client account? You will need a new pairing code to reconnect it.')) {
      return;
    }

    await runAction('EXTENSION/UNPAIR_BROWSER', async () => {
      await sendExtensionMessage({ type: 'EXTENSION/UNPAIR_BROWSER' });
    });
  }

  async function copyAnswer() {
    if (!state) return;

    const lines = suggestions.length > 0
      ? suggestions.map((s, i) =>
        [
          `Question ${i + 1}: ${s.questionText}`,
          `Suggested: ${s.suggestedOption ?? s.answerText ?? 'No match'}`,
          s.shortExplanation ? `Why: ${s.shortExplanation}` : null,
        ].filter(Boolean).join('\n'),
      )
      : [];

    const text = lines.join('\n\n') || state.lastSuggestion.answerText || state.lastSuggestion.suggestedOption || '';
    if (text) await navigator.clipboard.writeText(text);
  }

  async function grantSitePermission() {
    await runAction('grant-site', async () => {
      setSiteAccessMessage(null);
      const latestAccessResponse = await sendExtensionMessage<SiteAccessResult>({
        type: 'EXTENSION/CHECK_SITE_ACCESS',
      });
      const latestAccess = latestAccessResponse.ok && latestAccessResponse.data ? latestAccessResponse.data : access;
      if (!latestAccess || latestAccess.status !== 'not_granted' || !latestAccess.origin) {
        await refreshAccess();
        return;
      }
      const granted = await chrome.permissions.request({ origins: [latestAccess.origin] });
      await refreshAccess();
      if (!granted) {
        setSiteAccessMessage(
          `Chrome did not grant access for ${latestAccess.host}. Retry or open the extension details and allow site access.`,
        );
      }
    });
  }

  async function requestPortalPermissionFromGesture() {
    const normalizedUrl = normalizeAppUrl(appBaseUrl || 'https://study-assistant-web.vercel.app');
    const originPattern = normalizeOriginPattern(normalizedUrl);
    const alreadyGranted = await chrome.permissions.contains({ origins: [originPattern] });

    if (alreadyGranted) {
      return { granted: true, normalizedUrl };
    }

    const granted = await chrome.permissions.request({ origins: [originPattern] });
    return { granted, normalizedUrl };
  }

  async function requestConnectionPermission() {
    await runAction('pairing-permission', async () => {
      const permission = await requestPortalPermissionFromGesture();
      if (!permission.granted) {
        setPairingFeedback({
          tone: 'warning',
          message: 'Permission was not granted. Allow the trusted portal origin before pairing this browser.',
        });
        return;
      }

      const response = await sendExtensionMessage<{ granted?: boolean }, { appBaseUrl: string }>({
        type: 'EXTENSION/REQUEST_HOST_PERMISSION',
        payload: { appBaseUrl: permission.normalizedUrl },
      });

      if (response.ok && response.data?.granted) {
        setPairingFeedback({
          tone: 'success',
          message: `Connection permission granted for ${permission.normalizedUrl}.`,
        });
      } else if (response.ok) {
        setPairingFeedback({
          tone: 'warning',
          message: 'Permission was not granted. Allow the trusted portal origin before pairing this browser.',
        });
      } else {
        setPairingFeedback({
          tone: 'warning',
          message: response.error ?? 'Permission request was denied. Allow the portal origin to continue.',
        });
      }
    });
  }

  async function pairCurrentBrowser() {
    await runAction('pair-browser', async () => {
      const permission = await requestPortalPermissionFromGesture();
      if (!permission.granted) {
        setPairingFeedback({
          tone: 'warning',
          message: 'Allow the trusted portal permission first, then pair this browser.',
        });
        return;
      }

      const payload: PairExtensionPayload = {
        appBaseUrl: permission.normalizedUrl,
        pairingCode: pairingCode.trim().toUpperCase(),
        deviceName: deviceName.trim() || 'My Study Device',
      };

      const response = await sendExtensionMessage({
        type: 'EXTENSION/PAIR_EXTENSION',
        payload,
      });

      if (response.ok) {
        setPairingCode('');
        setPairingJustCompleted(true);
        setPairingFeedback({
          tone: 'success',
          message: 'Extension paired successfully. Study Assistant is ready in this side panel.',
        });
        return;
      }

      setPairingFeedback({
        tone: 'danger',
        message: response.error ?? 'Pairing failed. Check the app URL and pairing code, then try again.',
      });
    });
  }

  async function openPortalDraft() {
    const targetUrl = normalizeAppUrl(appBaseUrl || 'https://study-assistant-web.vercel.app');
    await chrome.tabs.create({ url: targetUrl });
  }

  useEffect(() => {
    if (!isPaired || subjectMode !== 'picker' || subjectsLoadingRef.current || availableSubjects.length > 0) {
      return;
    }

    void refreshSubjectCatalog();
  }, [availableSubjects.length, isPaired, refreshSubjectCatalog, subjectMode]);

  useEffect(() => {
    if (!isPaired || subjectMode !== 'picker' || !subjectPickerOpen) {
      return;
    }

    void refreshSubjectCatalog();

    const intervalId = window.setInterval(() => {
      void refreshSubjectCatalog();
    }, 15_000);

    const handleWindowFocus = () => {
      void refreshSubjectCatalog();
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isPaired, refreshSubjectCatalog, subjectMode, subjectPickerOpen]);

  useEffect(() => {
    if (isPaired) {
      return;
    }

    subjectsLoadingRef.current = false;
    setAvailableSubjects([]);
    setSubjectsLoading(false);
    setSubjectsError(null);
    setSubjectsLastSyncedAt(null);
  }, [isPaired]);

  useEffect(() => {
    if (!isPaired || !manualSubject || availableSubjects.length === 0) {
      return;
    }

    const subjectStillExists = availableSubjects.some((subject) => subject.name === manualSubject);
    if (subjectStillExists) {
      return;
    }

    setSubjectMode('auto');
    setSubjectPickerOpen(false);
    setSubjectSearch('');
    setOverrideDraft({ subject: '', category: '' });
    setSubjectsError('The locked subject was removed from the portal. Auto Detect is active again.');

    void sendExtensionMessage({
      type: 'EXTENSION/SET_MANUAL_OVERRIDE',
      payload: { subject: '', category: '' },
    });
  }, [availableSubjects, isPaired, manualSubject]);

  /* ---------------------------------------------------------------- */
  /*  Render: Loading state                                            */
  /* ---------------------------------------------------------------- */
  if (!state) {
    return (
      <div className="panel-shell panel-loading">
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--sa-accent)' }} />
        <p style={{ color: 'var(--sa-muted)', fontSize: 12 }}>Loading extension…</p>
      </div>
    );
  }

  const nextPrimaryAction =
    !isPaired ? 'pair'
      : !siteAccessGranted ? 'grant'
        : state.session.status === 'session_inactive' ? 'start'
          : 'ready';
  const showAnswerWorkspace = isPaired && nextPrimaryAction === 'ready' && workspaceView === 'answering';
  const showControlsWorkspace = isPaired && !showAnswerWorkspace;
  const activeSubjectLabel =
    manualSubject
    || cachedSubject
    || state.lastSuggestion.detectedSubject
    || state.lastSuggestion.subject
    || 'Auto Detect';
  const answeringModeLabel = manualSubject
    ? 'Locked subject'
    : cachedSubject
      ? 'Detected subject'
      : 'Auto Detect';

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="panel-shell">
      {/* ======== HEADER ======== */}
      <header className="panel-hero">
        <div className="panel-hero__brand">
          <div className="panel-hero__logo">
            <img src="../../brand/study-assistant-crest.svg" alt="" />
          </div>
          <div style={{ flex: 1 }}>
            <p className="panel-hero__eyebrow">Study Assistant</p>
            <h1>{isPaired ? (manualSubject || cachedSubject || 'Ready') : 'Pair This Browser'}</h1>
          </div>
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        {isPaired ? (
          <>
            {/* Status pills */}
            <div className="panel-hero__status">
              <UiStatusPill status={state.uiStatus} />
              <SessionStatusPill status={state.session.status} />
              {access && (
                <span className={`status-pill ${siteAccessGranted ? 'status-pill--success' : 'status-pill--warning'}`}>
                  {siteAccessGranted ? <Unlock size={9} /> : <Lock size={9} />}
                  {siteAccessGranted ? 'Site Access' : 'Access Needed'}
                </span>
              )}
            </div>

            {/* Metrics */}
            <div className="hero-metrics-row" style={{ alignItems: 'flex-start', marginTop: '4px' }}>
              <div className="hero-metric" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--sa-text)', flex: 1 }}>
                <Zap size={14} style={{ position: 'relative', top: '-1px' }} />
                <span className={displayRemainingSeconds < 1800 ? 'text-danger' : ''}>
                  {formatDurationDetailed(displayRemainingSeconds)}
                </span>
                <div style={{ fontSize: '10px', color: 'var(--sa-muted)', fontWeight: 'normal', marginLeft: '18px', marginTop: '-2px' }}>Remaining Time</div>
              </div>
              <div className="hero-metric" style={{ marginTop: '4px' }}>
                <BookOpen size={11} />
                <span className="truncate">{activeSubjectSummary}</span>
              </div>
            </div>

            {/* Grant / Start session buttons */}
            {nextPrimaryAction === 'grant' && (
              <div className="panel-hero__actions">
                <button
                  className="action-button action-button--primary"
                  onClick={() => void grantSitePermission()}
                  disabled={pendingAction !== null}
                >
                  <Unlock size={16} />
                  {pendingAction === 'grant-site' ? 'Requesting…' : 'Grant Site Access'}
                </button>
              </div>
            )}

            {nextPrimaryAction === 'start' && (
              <div className="panel-hero__actions">
                <button
                  className="action-button action-button--primary"
                  onClick={() => void sendSimple('EXTENSION/START_SESSION')}
                  disabled={pendingAction !== null || effectiveRemainingSeconds === 0 || isMaintenanceMode}
                >
                  <Play size={16} /> Start Session
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="panel-hero__copy">
              Pair this browser directly in the side panel. Open your portal, copy the short-lived code, then paste it into the highlighted field below.
            </p>
            <div className="panel-hero__actions">
              <button
                className="action-button"
                onClick={() => void openPortalDraft()}
              >
                <LayoutDashboard size={16} /> Open Web Portal
              </button>
            </div>
            <div className="hero-metrics-row" style={{ marginTop: 8 }}>
              <div className="hero-metric text-danger">
                <WifiOff size={11} />
                <span>Disconnected</span>
              </div>
              <div className="hero-metric">
                <BadgeCheck size={11} />
                <span>{state.extensionVersion ? `v${state.extensionVersion}` : 'Waiting for pairing'}</span>
              </div>
            </div>
          </>
        )}
      </header>

      {isPaired && pairingJustCompleted && pairingFeedback?.tone === 'success' && (
        <div className="notice notice--success">
          <p>{pairingFeedback.message}</p>
        </div>
      )}

      {isPaired && (
        <section className="workspace-switcher">
          <div className="workspace-switcher__buttons">
            <button
              type="button"
              className={`workspace-switcher__button ${showControlsWorkspace ? 'workspace-switcher__button--active' : ''}`}
              onClick={() => setWorkspaceView('controls')}
            >
              <BookOpen size={14} />
              Controls
            </button>
            <button
              type="button"
              className={`workspace-switcher__button ${showAnswerWorkspace ? 'workspace-switcher__button--active' : ''}`}
              onClick={() => setWorkspaceView('answering')}
              disabled={nextPrimaryAction !== 'ready'}
            >
              <Sparkles size={14} />
              Answering
            </button>
          </div>
          {showControlsWorkspace ? (
            <div className="workspace-switcher__summary">
              <strong>Setup and detection controls</strong>
              <span>{activeSubjectSummary}</span>
            </div>
          ) : (
            <div className="workspace-switcher__subject">
              <span>Answering subject</span>
              <strong>{activeSubjectLabel}</strong>
            </div>
          )}
        </section>
      )}

      {!isPaired && (
        <SectionCard
          title="Pair This Browser"
          subtitle="No extra onboarding tab is needed. Paste the short-lived code first, then approve the portal and pair here."
          icon={Link2}
          className="panel-card--primary"
          actions={(
            <button
              className="link-button text-xs flex-center-gap"
              onClick={() => void openPortalDraft()}
              title="Open your client portal"
            >
              <LayoutDashboard size={11} />
              Portal
            </button>
          )}
        >
          <div className="pairing-code-spotlight">
            <div className="pairing-code-spotlight__header">
              <div>
                <span className="pairing-code-spotlight__eyebrow">Required action</span>
                <strong>Enter Pairing Code</strong>
                <p>Generate a 6-letter code from your web portal and paste it below.</p>
              </div>
            </div>

            <label className="pairing-field pairing-field--code">
              <input
                value={pairingCode}
                onChange={(event) => setPairingCode(event.target.value.toUpperCase())}
                spellCheck={false}
                placeholder="Ex. ABCDEF"
              />
            </label>

            <button
              className="action-button action-button--primary"
              onClick={() => void pairCurrentBrowser()}
              disabled={pendingAction !== null || !pairingCode.trim()}
              style={{ padding: '14px', fontSize: '14px' }}
            >
              <Link2 size={16} />
              {pendingAction === 'pair-browser' ? 'Pairing...' : 'Pair Extension'}
            </button>
          </div>

          <div className="pairing-form-grid" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--sa-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Connection Settings</span>
            </div>
            
            <label className="pairing-field">
              <span>Host URL</span>
              <input
                value={appBaseUrl}
                onChange={(event) => setAppBaseUrl(event.target.value)}
                spellCheck={false}
              />
            </label>

            <label className="pairing-field">
              <span>Device Name</span>
              <input
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                spellCheck={false}
              />
            </label>
          </div>

          <div className="pairing-button-row" style={{ marginTop: 16 }}>
            <button
              className="action-button"
              onClick={() => void requestConnectionPermission()}
              disabled={pendingAction !== null}
            >
              <ShieldCheck size={15} />
              {pendingAction === 'pairing-permission' ? 'Requesting...' : 'Approve Connection Access'}
            </button>
          </div>

          {pairingFeedback && (
            <div className={`notice notice--${pairingFeedback.tone}`}>
              <p>{pairingFeedback.message}</p>
            </div>
          )}
        </SectionCard>
      )}

      {showAnswerWorkspace && (
        <section className="quick-action-bar">
          <button
            className="quick-action-btn quick-action-btn--reset"
            onClick={() => void sendSimple('EXTENSION/RESET_EXAM')}
            disabled={pendingAction !== null}
            title="Clear everything and start a new exam/subject"
          >
            <RotateCcw size={14} />
            <span>New Exam</span>
          </button>

          <button
            className={`quick-action-btn ${isFullAutoOn ? 'quick-action-btn--active' : 'quick-action-btn--auto'}`}
            onClick={() => void toggleFullAuto(!isFullAutoOn)}
            disabled={pendingAction !== null || !siteAccessGranted}
            title="Auto Pilot: analyze -> click answer -> next page"
          >
            <BotMessageSquare size={14} />
            <span>{isFullAutoOn ? 'Auto: ON' : 'Full Auto'}</span>
          </button>

          <button
            className="quick-action-btn quick-action-btn--select"
            onClick={() => void triggerAutoClickAll()}
            disabled={pendingAction !== null || suggestions.length === 0 || isAnalyzing}
            title="Click all matched answers on the page at once"
          >
            <ListChecks size={14} />
            <span>Select All</span>
          </button>
        </section>
      )}

      {showControlsWorkspace && (
        <SectionCard
          title="Subject Mode"
          subtitle="Keep Auto Detect on, or lock one real subject from your portal list before you search."
          icon={BookOpen}
          actions={(
            <div className="subject-card-actions">
              {subjectsSyncedLabel && (
                <span className="subject-sync-label">Synced {subjectsSyncedLabel}</span>
              )}
              <button
                className="link-button text-xs flex-center-gap"
                onClick={() => void refreshSubjectCatalog()}
                disabled={subjectsLoading}
                title="Refresh subject list"
              >
                <RefreshCw size={11} className={subjectsLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          )}
        >
          <div className="subject-mode-toggle">
            <button
              type="button"
              className={`subject-mode-toggle__button ${subjectMode === 'auto' ? 'subject-mode-toggle__button--active' : ''}`}
              onClick={() => void enableAutoDetect()}
              disabled={pendingAction !== null || (state.session.detectionMode === 'auto' && !manualSubject)}
            >
              Auto Detect
            </button>
            <button
              type="button"
              className={`subject-mode-toggle__button ${subjectMode === 'picker' ? 'subject-mode-toggle__button--active' : ''}`}
              onClick={() => {
                setSubjectMode('picker');
                setSubjectPickerOpen(true);
                void refreshSubjectCatalog();
              }}
              disabled={pendingAction !== null}
            >
              Subject Picker
            </button>
          </div>

          {subjectMode === 'picker' ? (
            <div className="subject-picker-panel">
              <label className="subject-picker-field">
                <span>Pick one real subject from your admin portal list</span>
                <div className={`subject-combobox ${subjectPickerOpen ? 'subject-combobox--open' : ''}`}>
                  <button
                    type="button"
                    className="subject-combobox__trigger"
                    onClick={() => setSubjectPickerOpen((current) => !current)}
                  >
                    <span>{selectedSubjectLabel || 'Open the subject list'}</span>
                    <ChevronDown size={14} className={subjectPickerOpen ? 'subject-combobox__chevron--open' : ''} />
                  </button>

                  {subjectPickerOpen && (
                    <div className="subject-combobox__menu">
                      <div className="subject-picker-search">
                        <Search size={14} />
                        <input
                          value={subjectSearch}
                          onChange={(event) => updateSubjectSearch(event.target.value)}
                          onKeyDown={(event) => {
                            const firstSuggestion = subjectSuggestions[0];
                            if (event.key === 'Enter' && firstSuggestion) {
                              event.preventDefault();
                              chooseSubject(firstSuggestion);
                            }
                          }}
                          placeholder="Type 2+ letters, like CA for Calculus"
                          autoFocus
                        />
                      </div>

                      <div className="subject-picker-results">
                        {subjectsLoading && availableSubjects.length === 0 ? (
                          <div className="subject-picker-empty">
                            <Loader2 size={14} className="animate-spin" />
                            <span>Loading your latest admin subject list...</span>
                          </div>
                        ) : subjectSuggestions.length > 0 ? (
                          <>
                            <div className="subject-picker-results__meta">
                              <span>
                                {subjectSearch.trim()
                                  ? `${subjectSuggestions.length} suggestion${subjectSuggestions.length === 1 ? '' : 's'}`
                                  : `${availableSubjects.length} subjects available`}
                              </span>
                              <span>{subjectsLoading ? 'Refreshing…' : 'Click one subject below'}</span>
                            </div>
                            <div className="subject-suggestion-list">
                              {subjectSuggestions.map((subject) => {
                                const isSelected = overrideDraft.subject === subject.name;
                                return (
                                  <button
                                    key={subject.id}
                                    type="button"
                                    className={`subject-suggestion ${isSelected ? 'subject-suggestion--active' : ''}`}
                                    onClick={() => chooseSubject(subject)}
                                  >
                                    <div className="subject-suggestion__content">
                                      <span className="subject-suggestion__name">{subject.name}</span>
                                      {subject.course_code && (
                                        <span className="subject-suggestion__meta">{subject.course_code}</span>
                                      )}
                                    </div>
                                    {isSelected && <CheckCircle2 size={14} />}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <div className="subject-picker-empty">
                            {subjectsLoading ? <Loader2 size={14} className="animate-spin" /> : <Info size={14} />}
                            <span>
                              {availableSubjects.length === 0
                                ? 'No portal subjects are available yet. Refresh after you add one in the admin portal.'
                                : 'No subjects matched that search yet.'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </label>

              <div className="subject-picker-selection">
                <span>Chosen subject</span>
                <strong>{selectedSubjectLabel || 'Nothing selected yet'}</strong>
              </div>

              <div className="subject-picker-actions">
                <button
                  className="action-button action-button--primary"
                  onClick={() => void applySelectedSubject()}
                  disabled={pendingAction !== null || !overrideDraft.subject}
                >
                  <CheckCircle2 size={15} />
                  Select Subject
                </button>
                <button
                  className="action-button"
                  onClick={() => void enableAutoDetect()}
                  disabled={pendingAction !== null}
                >
                  <RotateCcw size={15} />
                  Back to Auto
                </button>
              </div>

              {subjectsError && (
                <div className="notice notice--warning">
                  <p>{subjectsError}</p>
                </div>
              )}

              <div className="notice notice--info">
                <p>
                  Once selected, Detection Summary and Find All Answers will reuse that subject until you switch back to Auto Detect.
                  {subjectPickerOpen ? ' This list auto-refreshes while open so new portal subjects appear here.' : ''}
                </p>
              </div>
            </div>
          ) : (
            <div className="notice notice--info">
              <p>Auto Detect stays on. Open Subject Picker only when you want to lock one real subject and save extra detection work.</p>
            </div>
          )}
        </SectionCard>
      )}


      {showAnswerWorkspace && (
        <SectionCard
          title="Find Answers"
          icon={Sparkles}
          className="panel-card--primary"
          actions={(
            <button
              className="link-button text-xs flex-center-gap"
              onClick={() => setWorkspaceView('controls')}
            >
              <ArrowLeft size={11} />
              Back to Controls
            </button>
          )}
        >
          <div className="answering-hero">
            <div className="answering-hero__summary">
              <span className="answering-hero__eyebrow">Answering Subject</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <strong style={{ fontSize: '14px' }}>{activeSubjectLabel}</strong>
                {manualSubject ? (
                  <span className="status-badge status-badge--info" style={{ padding: '2px 6px', fontSize: '9px' }}>Locked</span>
                ) : cachedSubject ? (
                  <span className="status-badge status-badge--success" style={{ padding: '2px 6px', fontSize: '9px' }}>Auto-Detected</span>
                ) : null}
              </div>
            </div>

            <div className="answering-hero__pills" style={{ marginBottom: '16px' }}>
              <span className="answering-hero__pill">
                <FileSearch size={11} /> {detectedQuestionCount > 0 ? `${detectedQuestionCount} questions` : 'No questions'} 
              </span>
              {quizTitle && (
                <span className="answering-hero__pill truncate" style={{ maxWidth: '140px' }}>
                  {quizTitle}{quizNumber ? ` (#${quizNumber})` : ''}
                </span>
              )}
              {state?.currentPage?.courseCodes && state.currentPage.courseCodes.length > 0 && (
                <span className="answering-hero__pill truncate" style={{ maxWidth: '80px' }}>
                  {state.currentPage.courseCodes[0]}
                </span>
              )}
              {state?.lastSuggestion?.confidence !== null && (
                <span className="answering-hero__pill">
                   <ConfidenceBadge confidence={state.lastSuggestion.confidence} />
                </span>
              )}
            </div>

            <section className="steps-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Step 1: Detect Subject */}
              <div className="step-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="step-badge" style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: (!cachedSubject && !manualSubject) ? 'var(--sa-accent)' : 'var(--sa-background-alt)', color: (!cachedSubject && !manualSubject) ? 'white' : 'var(--sa-text)', borderRadius: '50%', fontSize: '11px', fontWeight: 600 }}>1</span>
                <button
                  className={`action-button ${(!cachedSubject && !manualSubject) ? 'action-button--primary action-button--lg' : 'action-button--detect'}`}
                  onClick={() => void sendAnalyze('detect', 'current')}
                  disabled={!canAnalyze || pendingAction !== null}
                  style={{ flex: 1, ...((cachedSubject || manualSubject) ? { backgroundColor: 'var(--sa-background-alt)' } : {}) }}
                >
                  {state!.uiStatus === 'detecting_subject'
                    ? <><Loader2 size={15} className="animate-spin" /> Detecting…</>
                    : <><FileSearch size={15} /> {(!cachedSubject && !manualSubject) ? 'Detect Subject' : 'Re-detect Subject' }</>
                  }
                </button>
              </div>

              {/* Step 2: Find Answers */}
              <div className="step-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="step-badge" style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: (cachedSubject || manualSubject) ? 'var(--sa-accent)' : 'var(--sa-background-alt)', color: (cachedSubject || manualSubject) ? 'white' : 'var(--sa-muted)', borderRadius: '50%', fontSize: '11px', fontWeight: 600 }}>2</span>
                <button
                  className={`action-button ${(!cachedSubject && !manualSubject) ? '' : 'action-button--primary action-button--lg'}`}
                  onClick={() => void sendAnalyze('analyze', 'current', 'subject_first')}
                  disabled={!canAnalyze || pendingAction !== null || (!cachedSubject && !manualSubject)}
                  style={{ flex: 1, ...((!cachedSubject && !manualSubject) ? { background: 'var(--sa-background-alt)', color: 'var(--sa-muted)', cursor: 'not-allowed', opacity: 0.8 } : {}) }}
                >
                  {isAnalyzing && state!.uiStatus !== 'detecting_subject'
                    ? <><Loader2 size={16} className="animate-spin" /> Finding Answers…</>
                    : <><Sparkles size={16} /> Find All Answers</>
                  }
                </button>
              </div>
            </section>
          </div>
        </SectionCard>
      )}

      {/* ======== PRIVACY STRIP ======== */}
      {/* ======== SITE ACCESS WARNING ======== */}
      {showControlsWorkspace && access && access.status !== 'granted' && (
        <SectionCard
          title="Site Access Required"
          subtitle={
            access.status === 'unsupported_page'
              ? 'This is an internal browser page that cannot be analyzed.'
              : `Grant permission to analyze pages on ${access.host || 'this site'}.`
          }
          icon={Globe}
        >
          {access.status === 'not_granted' && (
            <div className="action-grid mt-3">
              <button
                className="action-button action-button--primary"
                onClick={() => void grantSitePermission()}
                disabled={pendingAction !== null}
              >
                <Unlock size={16} />
                {pendingAction === 'grant-site' ? 'Requesting…' : 'Grant Access'}
              </button>
              <button
                className="action-button"
                onClick={() => void refreshAccess()}
                disabled={accessChecking}
              >
                <RefreshCw size={14} className={accessChecking ? 'animate-spin' : ''} />
                Retry
              </button>
            </div>
          )}
          {siteAccessMessage && (
            <div className="notice notice--warning mt-3">
              <p>{siteAccessMessage}</p>
            </div>
          )}
        </SectionCard>
      )}



      {/* ======== RESULTS SECTION ======== */}
      {showAnswerWorkspace && (
        <SectionCard
          title="Study Results"
          subtitle={
            isAnalyzing ? 'Searching sources…'
              : suggestions.length > 0
                ? `${suggestions.length} answer${suggestions.length > 1 ? 's' : ''} found`
                : hasSuggestion
                  ? `${sourceSubject}`
                  : 'Click Find All Answers to get started'
          }
          icon={Target}
          className="panel-card--primary"
          actions={
            <div className="flex-center-gap" style={{ gap: 6 }}>
              <button
                className="link-button text-xs flex-center-gap"
                onClick={() => void copyAnswer()}
                disabled={!hasSuggestion}
                title="Copy all results"
              >
                <Copy size={11} /> Copy
              </button>
              <button
                className="link-button text-xs flex-center-gap"
                onClick={() => void sendExtensionMessage({ type: 'EXTENSION/CLEAR_RESULTS' as any })}
                disabled={!hasSuggestion}
                title="Clear"
              >
                <XCircle size={11} /> Clear
              </button>
            </div>
          }
        >
          {isAnalyzing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <AnalyzeProgressBar />
              <button
                className="action-button action-button--sm"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  width: '100%',
                  justifyContent: 'center'
                }}
                onClick={() => void sendSimple('EXTENSION/CANCEL_ANALYZE')}
              >
                <XCircle size={14} /> Stop Search
              </button>
            </div>
          )}

          {/* Single answer mode (legacy/detect mode) */}
          {!isAnalyzing && state.lastSuggestion.answerText && suggestions.length === 0 && (
            <div className="answer-panel">
              <p style={{ fontWeight: 600 }}>{state.lastSuggestion.answerText}</p>
              {state.lastSuggestion.shortExplanation && (
                <p className="mt-2" style={{ color: 'var(--sa-muted)', fontSize: 12 }}>
                  {state.lastSuggestion.shortExplanation}
                </p>
              )}
            </div>
          )}

          {/* Multi-question results */}
          {!isAnalyzing && suggestions.length > 0 && (
            <div className="results-list">
              {suggestions.map((suggestion, index) => (
                <QuestionResultCard
                  key={suggestion.questionId}
                  suggestion={suggestion}
                  index={index}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isAnalyzing && !hasSuggestion && (
            <div className="empty-state">
              <Search size={24} style={{ color: 'var(--sa-muted)', opacity: 0.4 }} />
              <p>No results yet. Click <strong>Find All Answers</strong> to get started.</p>
            </div>
          )}

          {/* Warning */}
          {!isAnalyzing && state.lastSuggestion.warning && (
            <div className={`notice ${confidenceLevel === 'low' ? 'notice--warning' : 'notice--info'} mt-2`}>
              <p style={{ fontSize: 11 }}>{state.lastSuggestion.warning}</p>
            </div>
          )}
        </SectionCard>
      )}

      {showAnswerWorkspace && siteAccessGranted && (hasSuggestion || cachedSubject || manualSubject) && (
        <div className="detection-summary-card">
          <div className="detection-summary__header">
            <BookOpen size={14} style={{ color: 'var(--sa-accent)' }} />
            <h2>Detection Summary</h2>
          </div>
          <div className="detection-summary__grid">
            <div className="detection-summary__item">
              <span>Subject</span>
              <strong>{currentSubject}</strong>
            </div>
            <div className="detection-summary__item">
              <span>Questions</span>
              <strong>{detectedQuestionCount > 0 ? detectedQuestionCount : '—'}</strong>
            </div>
            {quizTitle && (
              <div className="detection-summary__item detection-summary__item--wide">
                <span>Quiz / Assessment</span>
                <strong>{quizTitle}{quizNumber ? ` (#${quizNumber})` : ''}</strong>
              </div>
            )}
            <div className="detection-summary__item">
              <span>Source Folder</span>
              <strong>{sourceSubject}</strong>
            </div>
            <div className="detection-summary__item">
              <span>Confidence</span>
              <strong><ConfidenceBadge confidence={state.lastSuggestion.confidence} /></strong>
            </div>
          </div>
          {state.lastSuggestion.fallbackApplied && (
            <div className="notice notice--warning mt-2" style={{ fontSize: 11 }}>
              <p>Fallback sources used — no direct match in detected subject folder.</p>
            </div>
          )}
        </div>
      )}

      {/* ======== SESSION CONTROLS ======== */}
      {showControlsWorkspace && (
        <SectionCard
          title="Session Controls"
          subtitle={state.session.status === 'session_active' ? 'Session is live' : 'Start a session to analyze'}
          icon={Clock}
          actions={(
            <div className="flex-center-gap">
               <span style={{ fontSize: 12, fontWeight: 600, color: displayRemainingSeconds < 1800 ? 'var(--sa-danger)' : 'var(--sa-accent)' }}>
                 {formatDurationDetailed(displayRemainingSeconds)}
               </span>
            </div>
          )}
        >
          <div className="action-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            <button
              className="action-button action-button--primary action-button--sm"
              onClick={() => void sendSimple('EXTENSION/START_SESSION')}
              disabled={pendingAction !== null || state.session.status === 'session_active' || effectiveRemainingSeconds === 0 || isMaintenanceMode}
              title="Start"
              style={{ padding: '6px' }}
            >
              <Play size={14} /> Start
            </button>
            <button
              className="action-button action-button--sm"
              onClick={() => void sendSimple('EXTENSION/PAUSE_SESSION')}
              disabled={pendingAction !== null || state.session.status !== 'session_active'}
              title="Pause"
              style={{ padding: '6px' }}
            >
              <Pause size={14} /> Pause
            </button>
            <button
              className="action-button action-button--sm"
              onClick={() => void sendSimple('EXTENSION/RESUME_SESSION')}
              disabled={pendingAction !== null || state.session.status !== 'session_paused' || effectiveRemainingSeconds === 0 || isMaintenanceMode}
              title="Resume"
              style={{ padding: '6px' }}
            >
              <Play size={14} /> Resume
            </button>
            <button
              className="action-button action-button--danger action-button--sm"
              onClick={() => void sendSimple('EXTENSION/END_SESSION')}
              disabled={pendingAction !== null || state.session.status === 'session_inactive'}
              title="End session"
              style={{ padding: '6px' }}
            >
              <Square size={14} /> End
            </button>
          </div>

          {effectiveRemainingSeconds === 0 && !isMaintenanceMode && (
            <div className="notice notice--danger mt-2" style={{ padding: '6px 8px' }}>
              <p style={{ fontSize: 11 }}>No credits remaining. Top up in portal.</p>
            </div>
          )}
          {isMaintenanceMode && (
            <div className="notice notice--warning mt-2" style={{ padding: '6px 8px' }}>
              <p style={{ fontSize: 11 }}>Maintenance mode is active. Client actions are temporarily paused.</p>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <button
              className="link-button flex-center-gap"
              onClick={() => void sendSimple('EXTENSION/REFRESH_CREDITS')}
              style={{ fontSize: 11 }}
            >
              <RefreshCw size={11} /> Refresh Credits
            </button>
            <button
              className="link-button flex-center-gap"
              onClick={() => void unpairBrowser()}
              disabled={pendingAction !== null}
              style={{ fontSize: 11, color: 'var(--sa-danger)' }}
            >
              <XCircle size={11} /> Unpair
            </button>
          </div>
        </SectionCard>
      )}

      {/* ======== ACTIVITY LOG (collapsible) ======== */}
      {showControlsWorkspace && (
      <details className="panel-disclosure">
        <summary className="panel-disclosure__summary">
          <div>
            <strong>Activity Log</strong>
            <p>Notices and recent actions.</p>
          </div>
          <ChevronDown size={14} />
        </summary>
        <div className="panel-disclosure__content">
          {state.notices.length > 0 && (
            <div className="notice-list mb-3">
              {state.notices.slice(0, 5).map((notice) => (
                <article key={notice.id} className={`notice notice--${notice.tone}`}>
                  <div className="flex-center-gap mb-1">
                    {notice.tone === 'danger' ? <XCircle size={12} /> : notice.tone === 'success' ? <CheckCircle2 size={12} /> : <Info size={12} />}
                    <strong style={{ fontSize: 12 }}>{notice.title}</strong>
                  </div>
                  <p>{notice.message}</p>
                </article>
              ))}
            </div>
          )}

          <div className="recent-list mb-3">
            {state.recentActions.length > 0 ? (
              state.recentActions.slice(0, 8).map((action) => (
                <div key={action.id} className="recent-list__item">
                  <strong className="truncate" style={{ maxWidth: 160, fontSize: 11 }}>{action.label}</strong>
                  <span>{new Date(action.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))
            ) : (
              <p className="muted-text px-2">No recent actions.</p>
            )}
            {pendingAction && (
              <div className="recent-list__item animate-pulse">
                <strong style={{ fontSize: 11 }}>Running {pendingAction}…</strong>
                <span>Now</span>
              </div>
            )}
          </div>

          <button
            className="link-button flex-center-gap"
            onClick={() => void sendSimple('EXTENSION/OPEN_DASHBOARD')}
            disabled={!isPaired}
            style={{ fontSize: 11 }}
          >
            <LayoutDashboard size={11} /> Open Dashboard
          </button>
        </div>
      </details>
      )}
    </div>
  );
}
