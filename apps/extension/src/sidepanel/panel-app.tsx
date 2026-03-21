import { useEffect, useState, useCallback } from 'react';

import { confidenceToLevel, formatConfidence, formatDurationDetailed } from '@study-assistant/shared-utils';
import type { ExtensionState, ExtensionQuestionSuggestion } from '@study-assistant/shared-types';

import type { AnalyzeCurrentPagePayload, ManualOverridePayload } from '../lib/messages';
import { fetchSubjects } from '../lib/api';
import { getStoredExtensionState, sendExtensionMessage, subscribeToExtensionState } from '../lib/runtime';
import { SectionCard } from './components/section-card';
import { SessionStatusPill, UiStatusPill } from './components/status-pill';
import {
  ShieldAlert, Zap, WifiOff, FileSearch, Sparkles, MonitorSmartphone, MousePointerClick,
  RefreshCw, XCircle, LayoutDashboard, Copy, Lock, Unlock, Globe,
  ChevronDown, ChevronRight, BookOpen, Search, Loader2, CheckCircle2, Info, Target, Play,
  RotateCcw, BotMessageSquare, ListChecks, AlertTriangle,
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
  const [availableSubjects, setAvailableSubjects] = useState<{ id: string; name: string }[]>([]);

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

  useEffect(() => {
    if (isPaired && state?.session.status === 'session_active') {
      fetchSubjects(state).then((res) => {
        if (res && res.subjects) {
          setAvailableSubjects(res.subjects);
        }
      }).catch(console.error);
    }
  }, [isPaired, state?.session.status, state]);

  const detectedQuestionCount = state?.currentPage?.totalQuestionsDetected
    ?? state?.currentPage?.questionCandidates.length
    ?? (state?.currentPage?.questionText ? 1 : 0);
  const suggestions = state?.lastSuggestion.questionSuggestions ?? [];
  const hasSuggestion = Boolean(state?.lastSuggestion.answerText) || suggestions.length > 0;
  const isAnalyzing = state?.uiStatus === 'scanning_page' || state?.uiStatus === 'detecting_subject' || state?.uiStatus === 'searching_sources';

  const cachedSubject = state?.session.cachedSubjectName ?? null;
  const currentSubject = state?.lastSuggestion.detectedSubject ?? state?.lastSuggestion.subject ?? cachedSubject ?? 'Auto';
  const sourceSubject = state?.lastSuggestion.sourceSubject ?? state?.lastSuggestion.detectedSubject ?? 'No source yet';
  const quizTitle = state?.currentPage?.quizTitle ?? null;
  const quizNumber = state?.currentPage?.quizNumber ?? null;

  const siteAccessGranted = access?.status === 'granted';
  const canAnalyze = isPaired && state?.session.status === 'session_active' && siteAccessGranted;
  const isFullAutoOn = state?.autoPilotEnabled ?? false;

  const confidenceLevel = confidenceToLevel(state?.lastSuggestion.confidence ?? null);

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
            <img src="../../brand/study-assistant-crest.svg" alt="" />
          </div>
          <div>
            <p className="panel-hero__eyebrow">Study Assistant</p>
            <h1>{isPaired ? (cachedSubject ? cachedSubject : 'Ready') : 'Connect First'}</h1>
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
                  {siteAccessGranted ? <Unlock size={9} /> : <Lock size={9} />}
                  {siteAccessGranted ? 'Site Access' : 'Access Needed'}
                </span>
              )}
            </div>

            {/* Metrics */}
            <div className="hero-metrics-row">
              <div className="hero-metric">
                <Zap size={11} />
                <span className={state.creditsRemainingSeconds < 1800 ? 'text-danger' : ''}>
                  {formatDurationDetailed(state.creditsRemainingSeconds)}
                </span>
              </div>
              <div className="hero-metric">
                <Globe size={11} />
                <span className="truncate">{currentPageLabel}</span>
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
                  disabled={pendingAction !== null || state.creditsRemainingSeconds === 0}
                >
                  <Play size={16} /> Start Session
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="panel-hero__copy">
              Open pairing, connect this browser to your portal account, then come back here.
            </p>
            <div className="panel-hero__actions">
              <button
                className="action-button action-button--primary"
                onClick={() => {
                  void chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') });
                }}
              >
                <MonitorSmartphone size={16} /> Open Pairing Setup
              </button>
              <button
                className="action-button"
                onClick={() => void sendSimple('EXTENSION/OPEN_DASHBOARD')}
              >
                <LayoutDashboard size={16} /> Web Portal
              </button>
            </div>
            <div className="hero-metrics-row" style={{ marginTop: 8 }}>
              <div className="hero-metric text-danger">
                <WifiOff size={11} />
                <span>Disconnected</span>
              </div>
            </div>
          </>
        )}
      </header>

      {/* ======== QUICK ACTION BAR ======== */}
      {isPaired && nextPrimaryAction === 'ready' && (
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
            title="Auto Pilot: analyze → click answer → next page (repeat)"
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

      {/* ======== STEP 1 & 2: DETECT + ANALYZE ======== */}
      {isPaired && nextPrimaryAction === 'ready' && (
        <section className="steps-section">
          {/* Step 1: Detect Subject */}
          <div className="step-row">
            <span className="step-badge">1</span>
            <button
              className="action-button action-button--detect"
              onClick={() => void sendAnalyze('detect', 'current')}
              disabled={!canAnalyze || pendingAction !== null}
            >
              {state.uiStatus === 'detecting_subject'
                ? <><Loader2 size={15} className="animate-spin" /> Detecting…</>
                : <><FileSearch size={15} /> {cachedSubject ? `Re-detect Subject` : `Detect Subject`}</>
              }
            </button>
            {cachedSubject && (
              <span className="step-cached-label" title="Cached subject — won't re-detect per question">
                <CheckCircle2 size={11} /> {cachedSubject}
              </span>
            )}
          </div>

          {/* Step 2: Find Answers */}
          <div className="step-row">
            <span className="step-badge">2</span>
            <button
              className="action-button action-button--primary action-button--lg"
              onClick={() => void sendAnalyze('analyze', 'current', 'subject_first')}
              disabled={!canAnalyze || pendingAction !== null}
            >
              {isAnalyzing && state.uiStatus !== 'detecting_subject'
                ? <><Loader2 size={16} className="animate-spin" /> Finding Answers…</>
                : <><Sparkles size={16} /> Find All Answers</>
              }
            </button>
          </div>
        </section>
      )}

      {/* ======== PRIVACY STRIP ======== */}
      {isPaired && (
        <section className="privacy-strip">
          <ShieldAlert size={13} className="shrink-0" style={{ color: 'var(--sa-accent)' }} />
          <p>AI reads the current tab only when you click Detect or Find Answers.</p>
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

      {/* ======== DETECTION SUMMARY (always visible when available) ======== */}
      {isPaired && siteAccessGranted && (hasSuggestion || cachedSubject) && (
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

      {/* ======== RESULTS SECTION ======== */}
      {isPaired && (
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

      {/* ======== SESSION CONTROLS (collapsible) ======== */}
      {isPaired && (
        <details className="panel-disclosure" open={state.session.status !== 'session_active'}>
          <summary className="panel-disclosure__summary">
            <div>
              <strong>Session Controls</strong>
              <p>{state.session.status === 'session_active' ? 'Session is live' : 'Start a session to analyze'}</p>
            </div>
            <ChevronDown size={14} />
          </summary>
          <div className="panel-disclosure__content">
            <div className="action-grid">
              <button
                className="action-button action-button--primary"
                onClick={() => void sendSimple('EXTENSION/START_SESSION')}
                disabled={pendingAction !== null || state.session.status === 'session_active' || state.creditsRemainingSeconds === 0}
              >
                Start
              </button>
              <button
                className="action-button"
                onClick={() => void sendSimple('EXTENSION/PAUSE_SESSION')}
                disabled={pendingAction !== null || state.session.status !== 'session_active'}
              >
                Pause
              </button>
              <button
                className="action-button"
                onClick={() => void sendSimple('EXTENSION/RESUME_SESSION')}
                disabled={pendingAction !== null || state.session.status !== 'session_paused' || state.creditsRemainingSeconds === 0}
              >
                Resume
              </button>
              <button
                className="action-button action-button--danger"
                onClick={() => void sendSimple('EXTENSION/END_SESSION')}
                disabled={pendingAction !== null || state.session.status === 'session_inactive'}
              >
                End Session
              </button>
            </div>

            {state.creditsRemainingSeconds === 0 && (
              <div className="notice notice--danger mt-2">
                <strong>No credits remaining</strong>
                <p>Top up your account in the web portal.</p>
              </div>
            )}

            <button
              className="link-button flex-center-gap mt-1"
              onClick={() => void sendSimple('EXTENSION/REFRESH_CREDITS')}
              style={{ fontSize: 11 }}
            >
              <RefreshCw size={11} /> Refresh Credits
            </button>
          </div>
        </details>
      )}

      {/* ======== DETECTION OVERRIDE (collapsible) ======== */}
      {isPaired && (
        <details className="panel-disclosure" open={confidenceLevel === 'low'}>
          <summary className="panel-disclosure__summary">
            <div>
              <strong>Detection Override</strong>
              <p>Manually set subject or category.</p>
            </div>
            <ChevronDown size={14} />
          </summary>
          <div className="panel-disclosure__content">
            <div className="detection-grid">
              <div className="metric-tile">
                <span>Subject</span>
                <strong>{state.lastSuggestion.subject ?? cachedSubject ?? 'Auto'}</strong>
              </div>
              <div className="metric-tile">
                <span>Category</span>
                <strong>{state.lastSuggestion.category ?? 'Auto'}</strong>
              </div>
            </div>

            <div className="override-grid mt-2">
              <label>
                <span>Manual Subject</span>
                <select
                  value={overrideDraft.subject}
                  onChange={(e) => setOverrideDraft((c) => ({ ...c, subject: e.target.value }))}
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--sa-border-subtle)', background: 'var(--sa-surface)', color: 'var(--sa-fg)', fontSize: '13px' }}
                >
                  <option value="">-- Auto Detect --</option>
                  {availableSubjects.map((sub) => (
                    <option key={sub.id} value={sub.name}>{sub.name}</option>
                  ))}
                </select>
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

      {/* ======== ACTIVITY LOG (collapsible) ======== */}
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
    </div>
  );
}
