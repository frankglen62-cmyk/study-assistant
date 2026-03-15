import { useEffect, useMemo, useState, useCallback } from 'react';

import { confidenceToLevel, formatConfidence, formatDurationDetailed } from '@study-assistant/shared-utils';
import type { ExtensionState, ExtensionQuestionSuggestion } from '@study-assistant/shared-types';

import type { AnalyzeCurrentPagePayload, ManualOverridePayload } from '../lib/messages';
import { getStoredExtensionState, sendExtensionMessage, subscribeToExtensionState } from '../lib/runtime';
import { SectionCard } from './components/section-card';
import { SessionStatusPill, UiStatusPill } from './components/status-pill';
import {
  ShieldAlert, Zap, WifiOff, FileSearch, Sparkles, UserRoundPlus, Server,
  Activity, MonitorSmartphone, MousePointerClick, AlignLeft, RefreshCw,
  XCircle, LayoutDashboard, Copy, AlertTriangle, Lock, Unlock, Globe,
  ExternalLink, ChevronDown, ChevronRight, BookOpen, Hash, Clock,
  Search, Loader2, CheckCircle2, AlertOctagon, Info,
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

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */
const PAGE_SIZE = 10;

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
function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-group">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${85 - i * 12}%` }} />
      ))}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  const level = confidenceToLevel(confidence);
  const label = confidence !== null ? formatConfidence(confidence) : 'N/A';
  return <span className={`confidence-badge confidence-badge--${level}`}>{label}</span>;
}

function QuestionResultCard({ suggestion, index, defaultExpanded }: {
  suggestion: ExtensionQuestionSuggestion;
  index: number;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const level = confidenceToLevel(suggestion.confidence);

  return (
    <article className={`result-card result-card--${level}`}>
      <button
        className="result-card__header"
        onClick={() => setExpanded((v) => !v)}
        type="button"
      >
        <div className="result-card__header-left">
          <span className="result-card__number">Q{index + 1}</span>
          <span className="result-card__prompt-preview">
            {suggestion.questionText.length > 80
              ? suggestion.questionText.slice(0, 80) + '…'
              : suggestion.questionText}
          </span>
        </div>
        <div className="result-card__header-right">
          <ConfidenceBadge confidence={suggestion.confidence} />
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      {expanded && (
        <div className="result-card__body">
          <div className="result-card__field">
            <span className="result-card__label">Full Question</span>
            <p className="result-card__value">{suggestion.questionText}</p>
          </div>

          <div className="result-card__field">
            <span className="result-card__label">Suggested Choice</span>
            <p className="result-card__value result-card__value--highlight">
              {suggestion.suggestedOption ?? suggestion.answerText ?? 'No match found'}
            </p>
          </div>

          {suggestion.shortExplanation && (
            <div className="result-card__field">
              <span className="result-card__label">Explanation</span>
              <p className="result-card__value">{suggestion.shortExplanation}</p>
            </div>
          )}

          <div className="result-card__source-row">
            <div className="result-card__source-pill">
              <BookOpen size={11} />
              <span>{suggestion.matchedSubject ?? 'Unknown source'}</span>
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
            {suggestion.matchedCategory && (
              <div className="result-card__source-pill">
                <span>{suggestion.matchedCategory}</span>
              </div>
            )}
          </div>

          {suggestion.warning && (
            <div className="result-card__warning">
              <AlertTriangle size={12} />
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
  const [editingOverride, setEditingOverride] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [siteAccessMessage, setSiteAccessMessage] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const isPaired = state?.pairingStatus === 'paired';
  const { access, checking: accessChecking, refresh: refreshAccess } = useSiteAccess(Boolean(isPaired));

  useEffect(() => {
    if (!state) return;
    setOverrideDraft({
      subject: state.session.manualSubject,
      category: state.session.manualCategory,
    });
  }, [state?.session.manualCategory, state?.session.manualSubject]);

  useEffect(() => {
    if (access?.status === 'granted' || access?.status === 'unsupported_page') {
      setSiteAccessMessage(null);
    }
  }, [access?.status]);

  // Reset pagination when suggestions change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [state?.lastSuggestion.questionSuggestions.length]);

  const detectedQuestionCount = state?.currentPage?.totalQuestionsDetected
    ?? state?.currentPage?.questionCandidates.length
    ?? (state?.currentPage?.questionText ? 1 : 0);
  const capturedSectionCount = state?.capturedSections.length ?? 0;
  const suggestions = state?.lastSuggestion.questionSuggestions ?? [];
  const hasSuggestion = Boolean(state?.lastSuggestion.answerText) || suggestions.length > 0;
  const isAnalyzing = state?.uiStatus === 'scanning_page' || state?.uiStatus === 'detecting_subject' || state?.uiStatus === 'searching_sources';

  const currentSubject = state?.lastSuggestion.detectedSubject ?? state?.lastSuggestion.subject ?? state?.session.manualSubject ?? 'Auto';
  const sourceSubject = state?.lastSuggestion.sourceSubject ?? state?.lastSuggestion.detectedSubject ?? 'No source yet';
  const quizTitle = state?.currentPage?.quizTitle ?? null;
  const quizNumber = state?.currentPage?.quizNumber ?? null;

  const siteAccessGranted = access?.status === 'granted';
  const canAnalyze = isPaired && state?.session.status === 'session_active' && siteAccessGranted;
  const canCapture = isPaired && siteAccessGranted;
  const canMerge = isPaired && state?.session.status === 'session_active' && capturedSectionCount > 0;

  const confidenceLevel = confidenceToLevel(state?.lastSuggestion.confidence ?? null);

  const visibleSuggestions = useMemo(
    () => suggestions.slice(0, visibleCount),
    [suggestions, visibleCount],
  );
  const hasMore = suggestions.length > visibleCount;

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
        payload: { mode, includeScreenshot: source === 'current', source, searchScope },
      });
    });
  }

  async function captureVisibleSection() {
    await runAction('EXTENSION/CAPTURE_VISIBLE_SECTION', async () => {
      await sendExtensionMessage({ type: 'EXTENSION/CAPTURE_VISIBLE_SECTION' });
    });
  }

  async function resetCapturedSections() {
    await runAction('EXTENSION/CLEAR_CAPTURED_SECTIONS', async () => {
      await sendExtensionMessage({ type: 'EXTENSION/CLEAR_CAPTURED_SECTIONS' });
    });
  }

  async function sendSimple(type:
    | 'EXTENSION/START_SESSION'
    | 'EXTENSION/PAUSE_SESSION'
    | 'EXTENSION/RESUME_SESSION'
    | 'EXTENSION/END_SESSION'
    | 'EXTENSION/REFRESH_CREDITS'
    | 'EXTENSION/OPEN_DASHBOARD'
    | 'EXTENSION/REPORT_WRONG_DETECTION') {
    await runAction(type, async () => {
      await sendExtensionMessage({ type });
    });
  }

  async function toggleLiveAssist(enabled: boolean) {
    await runAction('EXTENSION/TOGGLE_LIVE_ASSIST', async () => {
      await sendExtensionMessage({
        type: 'EXTENSION/TOGGLE_LIVE_ASSIST',
        payload: { enabled },
      });
    });
  }

  async function confirmOverride() {
    await runAction('EXTENSION/SET_MANUAL_OVERRIDE', async () => {
      await sendExtensionMessage({
        type: 'EXTENSION/SET_MANUAL_OVERRIDE',
        payload: overrideDraft,
      });
      setEditingOverride(false);
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
            s.warning ? `Warning: ${s.warning}` : null,
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

  /* ---------------------------------------------------------------- */
  /*  Render: Loading state                                            */
  /* ---------------------------------------------------------------- */
  if (!state) {
    return (
      <div className="panel-shell panel-loading">
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--panel-accent)' }} />
        <p style={{ color: 'var(--panel-muted)', marginTop: 12, fontSize: 13 }}>Loading extension state…</p>
      </div>
    );
  }

  const nextPrimaryAction =
    !isPaired ? 'pair'
    : !siteAccessGranted ? 'grant'
    : state.session.status === 'session_inactive' ? 'start'
    : 'analyze';

  const currentPageLabel = state.currentPage?.pageDomain ?? access?.host ?? 'No page analyzed';

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="panel-shell">
      {/* ======== HEADER ======== */}
      <header className="panel-hero">
        <div className="panel-hero__brand">
          <div className="panel-hero__logo">
            <Sparkles size={20} strokeWidth={2.5} />
          </div>
          <div>
            <p className="panel-hero__eyebrow">Study Assistant</p>
            <h1>{isPaired ? 'Ready to Analyze' : 'Connect First'}</h1>
          </div>
        </div>

        {isPaired ? (
          <>
            {/* Status pills */}
            <div className="panel-hero__status">
              <UiStatusPill status={state.uiStatus} />
              <SessionStatusPill status={state.session.status} />
              {access && (
                <span className={`status-pill ${siteAccessGranted ? 'status-pill--success' : 'status-pill--warning'}`}>
                  {siteAccessGranted ? <Unlock size={10} /> : <Lock size={10} />}
                  {siteAccessGranted ? 'Site Access' : 'Access Needed'}
                </span>
              )}
            </div>

            {/* Compact metrics row */}
            <div className="hero-metrics-row">
              <div className="hero-metric">
                <Zap size={12} />
                <span className={state.creditsRemainingSeconds < 1800 ? 'text-danger' : ''}>
                  {formatDurationDetailed(state.creditsRemainingSeconds)}
                </span>
              </div>
              <div className="hero-metric">
                <Globe size={12} />
                <span className="truncate">{currentPageLabel}</span>
              </div>
            </div>

            {/* Primary action buttons */}
            <div className="panel-hero__actions">
              {nextPrimaryAction === 'grant' ? (
                <button
                  className="action-button action-button--primary flex-center-gap justify-center"
                  onClick={() => void grantSitePermission()}
                  disabled={pendingAction !== null}
                >
                  <Unlock size={16} />
                  {pendingAction === 'grant-site' ? 'Requesting…' : 'Grant Site Access'}
                </button>
              ) : nextPrimaryAction === 'start' ? (
                <button
                  className="action-button action-button--primary flex-center-gap justify-center"
                  onClick={() => void sendSimple('EXTENSION/START_SESSION')}
                  disabled={pendingAction !== null || state.creditsRemainingSeconds === 0}
                >
                  <Activity size={16} /> Start Session
                </button>
              ) : (
                <button
                  className="action-button action-button--primary flex-center-gap justify-center"
                  onClick={() => void sendAnalyze('analyze', 'current', 'subject_first')}
                  disabled={!canAnalyze || pendingAction !== null}
                >
                  {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  Analyze Current Tab
                </button>
              )}
              <button
                className="action-button flex-center-gap justify-center"
                onClick={() => void sendAnalyze('detect', 'current')}
                disabled={!canAnalyze || pendingAction !== null}
              >
                <FileSearch size={16} /> Detect Question
              </button>
              {nextPrimaryAction === 'analyze' && (
                <button
                  className="action-button flex-center-gap justify-center"
                  onClick={() => void sendAnalyze('analyze', 'current', 'all_subjects')}
                  disabled={!canAnalyze || pendingAction !== null}
                >
                  <Search size={16} /> Search All Sources
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="panel-hero__copy">
              Open pairing, connect this browser to your portal account, then come back here.
            </p>
            <div className="panel-hero__actions">
              <button
                className="action-button action-button--primary flex-center-gap justify-center"
                onClick={() => {
                  void chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') });
                }}
              >
                <MonitorSmartphone size={16} /> Open Pairing Setup
              </button>
              <button
                className="action-button flex-center-gap justify-center"
                onClick={() => void sendSimple('EXTENSION/OPEN_DASHBOARD')}
              >
                <LayoutDashboard size={16} /> Web Portal
              </button>
            </div>
            <div className="hero-metrics-row" style={{ marginTop: 12 }}>
              <div className="hero-metric text-danger">
                <WifiOff size={12} />
                <span>Disconnected</span>
              </div>
            </div>
          </>
        )}
      </header>

      {/* ======== PRIVACY STRIP ======== */}
      {isPaired && (
        <section className="privacy-strip flex-center-gap">
          <ShieldAlert size={14} className="shrink-0" style={{ color: 'var(--panel-accent)' }} />
          <p>AI reads the current tab only when you click Analyze or enable Live Assist.</p>
        </section>
      )}

      {/* ======== SITE ACCESS WARNING ======== */}
      {isPaired && access && access.status !== 'granted' && (
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
                className="action-button action-button--primary flex-center-gap justify-center"
                onClick={() => void grantSitePermission()}
                disabled={pendingAction !== null}
              >
                <Unlock size={16} />
                {pendingAction === 'grant-site' ? 'Requesting…' : 'Grant Access'}
              </button>
              <button
                className="action-button flex-center-gap justify-center"
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

      {/* ======== DETECTION SUMMARY CARD ======== */}
      {isPaired && siteAccessGranted && (
        <div className="detection-summary-card">
          <div className="detection-summary__header">
            <BookOpen size={16} style={{ color: 'var(--panel-accent)' }} />
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
            <div className="notice notice--warning mt-2" style={{ fontSize: 12 }}>
              <p>Fallback sources used — no direct match in detected subject folder.</p>
            </div>
          )}
        </div>
      )}

      {/* ======== SESSION CONTROLS (collapsible) ======== */}
      {isPaired && (
        <details className="panel-disclosure panel-disclosure--session" open={state.session.status !== 'session_active'}>
          <summary className="panel-disclosure__summary">
            <div>
              <strong>Session Controls</strong>
              <p>{state.session.status === 'session_active' ? 'Session is live' : 'Start a session to analyze'}</p>
            </div>
            <ChevronDown size={16} />
          </summary>
          <div className="panel-disclosure__content">
            <div className="action-grid">
              <button
                className="action-button action-button--primary flex-center-gap justify-center"
                onClick={() => void sendSimple('EXTENSION/START_SESSION')}
                disabled={pendingAction !== null || state.session.status === 'session_active' || state.creditsRemainingSeconds === 0}
              >
                Start
              </button>
              <button
                className="action-button flex-center-gap justify-center"
                onClick={() => void sendSimple('EXTENSION/PAUSE_SESSION')}
                disabled={pendingAction !== null || state.session.status !== 'session_active'}
              >
                Pause
              </button>
              <button
                className="action-button flex-center-gap justify-center"
                onClick={() => void sendSimple('EXTENSION/RESUME_SESSION')}
                disabled={pendingAction !== null || state.session.status !== 'session_paused' || state.creditsRemainingSeconds === 0}
              >
                Resume
              </button>
              <button
                className="action-button action-button--danger flex-center-gap justify-center"
                onClick={() => void sendSimple('EXTENSION/END_SESSION')}
                disabled={pendingAction !== null || state.session.status === 'session_inactive'}
              >
                End Session
              </button>
            </div>

            {state.creditsRemainingSeconds === 0 && (
              <div className="notice notice--danger mt-3">
                <strong>No credits remaining</strong>
                <p>Top up your account in the web portal.</p>
              </div>
            )}

            <label className="toggle-card mt-3">
              <div>
                <strong className="flex-center-gap"><MousePointerClick size={14} /> Live Assist</strong>
                <p>Auto re-analyze when the page changes meaningfully.</p>
              </div>
              <input
                type="checkbox"
                checked={state.session.liveAssistEnabled}
                onChange={(event) => void toggleLiveAssist(event.target.checked)}
                disabled={!siteAccessGranted}
              />
            </label>

            <button
              className="link-button flex-center-gap mt-2"
              onClick={() => void sendSimple('EXTENSION/REFRESH_CREDITS')}
              style={{ fontSize: 12 }}
            >
              <RefreshCw size={12} /> Refresh Credits
            </button>
          </div>
        </details>
      )}

      {/* ======== RESULTS SECTION ======== */}
      {isPaired && (
        <SectionCard
          title="Study Results"
          subtitle={
            isAnalyzing ? 'Analyzing page…'
            : suggestions.length > 0
              ? `${suggestions.length} question${suggestions.length > 1 ? 's' : ''} analyzed`
              : hasSuggestion
                ? `${sourceSubject}`
                : 'Analyze a page to see results'
          }
          icon={AlignLeft}
          className="panel-card--primary panel-card--answer"
          actions={
            <div className="flex-center-gap" style={{ gap: 8 }}>
              <button
                className="link-button text-xs flex-center-gap"
                onClick={() => void copyAnswer()}
                disabled={!hasSuggestion}
                title="Copy all results"
              >
                <Copy size={12} /> Copy
              </button>
              <button
                className="link-button text-xs flex-center-gap"
                onClick={() => void sendSimple('EXTENSION/REPORT_WRONG_DETECTION')}
                title="Report wrong detection"
              >
                <AlertTriangle size={12} /> Report
              </button>
            </div>
          }
        >
          {/* Loading skeleton */}
          {isAnalyzing && <LoadingSkeleton lines={4} />}

          {/* Single answer mode (legacy/detect mode) */}
          {!isAnalyzing && state.lastSuggestion.answerText && suggestions.length === 0 && (
            <div className="answer-panel">
              <p>{state.lastSuggestion.answerText}</p>
              {state.lastSuggestion.shortExplanation && (
                <p className="mt-2" style={{ color: 'var(--panel-muted)', fontSize: 13 }}>
                  {state.lastSuggestion.shortExplanation}
                </p>
              )}
            </div>
          )}

          {/* Multi-question results */}
          {!isAnalyzing && visibleSuggestions.length > 0 && (
            <div className="results-list">
              {visibleSuggestions.map((suggestion, index) => (
                <QuestionResultCard
                  key={suggestion.questionId}
                  suggestion={suggestion}
                  index={index}
                  defaultExpanded={suggestions.length <= 3}
                />
              ))}

              {hasMore && (
                <button
                  className="action-button flex-center-gap justify-center"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                >
                  Show {Math.min(PAGE_SIZE, suggestions.length - visibleCount)} More
                  ({suggestions.length - visibleCount} remaining)
                </button>
              )}

              {!hasMore && suggestions.length > PAGE_SIZE && (
                <button
                  className="action-button flex-center-gap justify-center"
                  onClick={() => setVisibleCount(PAGE_SIZE)}
                  style={{ fontSize: 12 }}
                >
                  Collapse to first {PAGE_SIZE}
                </button>
              )}
            </div>
          )}

          {/* Empty state */}
          {!isAnalyzing && !hasSuggestion && (
            <div className="empty-state">
              <Search size={28} style={{ color: 'var(--panel-muted)', opacity: 0.5 }} />
              <p>No results yet. Click <strong>Analyze Current Tab</strong> to get started.</p>
            </div>
          )}

          {/* Warning */}
          {!isAnalyzing && state.lastSuggestion.warning && (
            <div className={`notice ${confidenceLevel === 'low' ? 'notice--warning' : 'notice--info'} mt-2`}>
              <p style={{ fontSize: 12 }}>{state.lastSuggestion.warning}</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* ======== DETECTION OVERRIDE (collapsible) ======== */}
      {isPaired && (
        <details className="panel-disclosure panel-disclosure--override" open={confidenceLevel === 'low'}>
          <summary className="panel-disclosure__summary">
            <div>
              <strong>Detection Override</strong>
              <p>Manually set subject or category if detection is wrong.</p>
            </div>
            <ChevronDown size={16} />
          </summary>
          <div className="panel-disclosure__content">
            <div className="detection-grid">
              <div className="metric-tile">
                <span>Subject</span>
                <strong>{state.lastSuggestion.subject ?? 'Auto'}</strong>
              </div>
              <div className="metric-tile">
                <span>Category</span>
                <strong>{state.lastSuggestion.category ?? 'Auto'}</strong>
              </div>
            </div>

            <div className="override-grid mt-2">
              <label>
                <span>Manual Subject</span>
                <input
                  value={overrideDraft.subject}
                  onChange={(e) => setOverrideDraft((c) => ({ ...c, subject: e.target.value }))}
                  placeholder="e.g. Physics"
                />
              </label>
              <label>
                <span>Manual Category</span>
                <input
                  value={overrideDraft.category}
                  onChange={(e) => setOverrideDraft((c) => ({ ...c, category: e.target.value }))}
                  placeholder="e.g. Midterm"
                />
              </label>
            </div>
            <button
              className="action-button action-button--primary mt-2"
              onClick={() => void confirmOverride()}
              disabled={pendingAction !== null}
              style={{ width: '100%' }}
            >
              Confirm Override
            </button>
          </div>
        </details>
      )}

      {/* ======== MANUAL CAPTURE (collapsible) ======== */}
      {isPaired && (
        <details className="panel-disclosure panel-disclosure--advanced" open={capturedSectionCount > 0}>
          <summary className="panel-disclosure__summary">
            <div>
              <strong>Manual Capture</strong>
              <p>For pages needing multiple manual section captures.</p>
            </div>
            <ChevronDown size={16} />
          </summary>
          <div className="panel-disclosure__content">
            <div className="action-grid">
              <button
                className="action-button action-button--primary flex-center-gap justify-center"
                onClick={() => void captureVisibleSection()}
                disabled={!canCapture || pendingAction !== null}
              >
                <ExternalLink size={16} />
                {capturedSectionCount > 0 ? 'Add Section' : 'Capture Section'}
              </button>
              <button
                className="action-button flex-center-gap justify-center"
                onClick={() => void sendAnalyze('analyze', 'captured')}
                disabled={!canMerge || pendingAction !== null}
              >
                <Sparkles size={16} /> Merge & Analyze
              </button>
            </div>

            {capturedSectionCount > 0 && (
              <>
                <div className="captured-section-list mt-2">
                  {state.capturedSections.map((section, i) => (
                    <article key={section.id} className="captured-section-card">
                      <div className="captured-section-card__header">
                        <strong>Section {i + 1}</strong>
                        <span>{section.questionCount} Q{section.questionCount !== 1 ? 's' : ''}</span>
                      </div>
                      <p className="captured-section-card__meta">
                        {new Date(section.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </article>
                  ))}
                </div>
                <button
                  className="link-button flex-center-gap mt-2"
                  onClick={() => void resetCapturedSections()}
                  disabled={pendingAction !== null}
                  style={{ fontSize: 12 }}
                >
                  <XCircle size={12} /> Reset Captures
                </button>
              </>
            )}
          </div>
        </details>
      )}

      {/* ======== ACTIVITY LOG (collapsible) ======== */}
      <details className="panel-disclosure">
        <summary className="panel-disclosure__summary">
          <div>
            <strong>Activity Log</strong>
            <p>Notices, warnings, and recent actions.</p>
          </div>
          <ChevronDown size={16} />
        </summary>
        <div className="panel-disclosure__content">
          {state.notices.length > 0 && (
            <div className="notice-list mb-3">
              {state.notices.slice(0, 5).map((notice) => (
                <article key={notice.id} className={`notice notice--${notice.tone}`}>
                  <div className="flex-center-gap mb-1">
                    {notice.tone === 'danger' ? <XCircle size={14} /> : notice.tone === 'success' ? <CheckCircle2 size={14} /> : <Info size={14} />}
                    <strong>{notice.title}</strong>
                  </div>
                  <p>{notice.message}</p>
                </article>
              ))}
            </div>
          )}

          <div className="recent-list mb-4">
            {state.recentActions.length > 0 ? (
              state.recentActions.slice(0, 8).map((action) => (
                <div key={action.id} className="recent-list__item">
                  <strong className="truncate" style={{ maxWidth: 180 }}>{action.label}</strong>
                  <span>{new Date(action.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))
            ) : (
              <p className="muted-text px-2">No recent actions.</p>
            )}
            {pendingAction && (
              <div className="recent-list__item animate-pulse">
                <strong>Running {pendingAction}…</strong>
                <span>Now</span>
              </div>
            )}
          </div>

          <button
            className="link-button flex-center-gap"
            onClick={() => void sendSimple('EXTENSION/OPEN_DASHBOARD')}
            disabled={!isPaired}
            style={{ fontSize: 12 }}
          >
            <LayoutDashboard size={12} /> Open Dashboard
          </button>
        </div>
      </details>
    </div>
  );
}
