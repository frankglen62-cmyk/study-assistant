import { useEffect, useMemo, useState } from 'react';

import type { ExtensionState } from '@study-assistant/shared-types';
import type { LucideIcon } from 'lucide-react';
import { normalizeOriginPattern } from '@study-assistant/shared-utils';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Copy,
  Globe,
  Link2,
  Monitor,
  ScreenShare,
  Share,
  ShieldCheck,
} from 'lucide-react';

import type { PairExtensionPayload } from '../lib/messages';
import { getStoredExtensionState, sendExtensionMessage, subscribeToExtensionState } from '../lib/runtime';
import { getExtensionVersion } from '../lib/auth';

const onboardingSteps: Array<{ title: string; description: string }> = [
  {
    title: 'Enter the web portal host',
    description: 'Point the extension to the exact client dashboard URL you trust.',
  },
  {
    title: 'Grant permission safely',
    description: 'Allow this browser to talk only to that app origin and nothing broader.',
  },
  {
    title: 'Paste the pairing code',
    description: 'Use the short-lived code generated from the client portal for this device.',
  },
  {
    title: 'Open the dashboard',
    description: 'Finish pairing, confirm the installed build, and continue in the side panel.',
  },
];

function useOnboardingState() {
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

function formatPairingState(status: ExtensionState['pairingStatus'] | null | undefined) {
  switch (status) {
    case 'paired':
      return 'PAIRED';
    case 'revoked':
      return 'REVOKED';
    case 'not_paired':
      return 'READY TO PAIR';
    default:
      return 'CHECKING STATE';
  }
}

function formatSummaryState(status: ExtensionState['pairingStatus'] | null | undefined) {
  switch (status) {
    case 'paired':
      return 'Paired';
    case 'revoked':
      return 'Revoked';
    case 'not_paired':
      return 'Not paired';
    default:
      return 'Loading';
  }
}

export function OnboardingApp() {
  const state = useOnboardingState();
  const extensionVersion = useMemo(() => getExtensionVersion(), []);
  const [appBaseUrl, setAppBaseUrl] = useState('https://study-assistant-web.vercel.app');
  const [pairingCode, setPairingCode] = useState('');
  const [deviceName, setDeviceName] = useState('My Study Device');
  const [statusMessage, setStatusMessage] = useState('Ready to request permission and pair this browser securely.');
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.appBaseUrl) {
      setAppBaseUrl(state.appBaseUrl);
    }

    if (state.deviceName) {
      setDeviceName(state.deviceName);
    }

    if (state.pairingStatus === 'paired' && statusMessage === 'Ready to request permission and pair this browser securely.') {
      setStatusMessage('Extension paired successfully.');
    }
  }, [state, statusMessage]);

  async function runAction(label: string, operation: () => Promise<void>) {
    setPending(label);
    try {
      await operation();
    } finally {
      setPending(null);
    }
  }

  async function allowOrigin() {
    await runAction('permission', async () => {
      const origin = normalizeOriginPattern(appBaseUrl);
      const granted = await chrome.permissions.request({ origins: [origin] });

      if (!granted) {
        setStatusMessage('Permission request was denied. Allow the app origin to continue with secure pairing.');
        return;
      }

      const response = await sendExtensionMessage({
        type: 'EXTENSION/REQUEST_HOST_PERMISSION',
        payload: { appBaseUrl },
      });
      setStatusMessage(response.ok ? 'Connection permission granted.' : response.error ?? 'Permission request failed.');
    });
  }

  async function pairExtension() {
    const payload: PairExtensionPayload = {
      appBaseUrl,
      pairingCode,
      deviceName,
    };

    await runAction('pair', async () => {
      const origin = normalizeOriginPattern(appBaseUrl);
      const alreadyGranted = await chrome.permissions.contains({ origins: [origin] });

      if (!alreadyGranted) {
        const granted = await chrome.permissions.request({ origins: [origin] });
        if (!granted) {
          setStatusMessage('Allow the app connection permission before pairing this browser.');
          return;
        }

        await sendExtensionMessage({
          type: 'EXTENSION/REQUEST_HOST_PERMISSION',
          payload: { appBaseUrl },
        });
      }

      const response = await sendExtensionMessage({
        type: 'EXTENSION/PAIR_EXTENSION',
        payload,
      });
      setStatusMessage(response.ok ? 'Extension paired successfully.' : response.error ?? 'Pairing failed.');
    });
  }

  async function openDashboard() {
    await runAction('dashboard', async () => {
      await sendExtensionMessage({ type: 'EXTENSION/OPEN_DASHBOARD' });
    });
  }

  const isPaired = state?.pairingStatus === 'paired';
  const pairingStateLabel = formatPairingState(state?.pairingStatus);
  const summaryState = formatSummaryState(state?.pairingStatus);
  const statusTone =
    statusMessage.toLowerCase().includes('failed') || statusMessage.toLowerCase().includes('denied')
      ? 'danger'
      : statusMessage.toLowerCase().includes('successful') || statusMessage.toLowerCase().includes('granted') || isPaired
        ? 'success'
        : 'neutral';

  const summaryItems: Array<{ label: string; value: string; icon: LucideIcon; tone?: 'success' | 'default' }> = [
    {
      label: 'Pairing Status',
      value: summaryState,
      icon: ShieldCheck,
      tone: isPaired ? 'success' : 'default',
    },
    {
      label: 'App Host',
      value: state?.appBaseUrl || appBaseUrl,
      icon: Globe,
    },
    {
      label: 'Device Name',
      value: state?.deviceName ?? deviceName,
      icon: Copy,
    },
    {
      label: 'Extension Target',
      value: state?.browserName ?? 'Google Chrome',
      icon: Monitor,
    },
    {
      label: 'Installed Build',
      value: `v${extensionVersion}`,
      icon: BadgeCheck,
    },
    {
      label: 'Next Step',
      value: isPaired ? 'Open side panel' : 'Finish pairing',
      icon: Link2,
    },
  ];

  return (
    <div className="onboarding-shell">
      <aside className="onboarding-overview" aria-label="Pairing overview">
        <div className="onboarding-overview__brandmark" aria-hidden="true">
          <img src="../../brand/study-assistant-crest.svg" alt="" />
        </div>

        <div className="onboarding-overview__header">
          <p className="onboarding-kicker">Chrome extension</p>
          <h1>Pair the Study Assistant safely</h1>
        </div>

        <div className="onboarding-badge-row">
          <span className="onboarding-badge onboarding-badge--build">{`Extension v${extensionVersion}`}</span>
          <span className={`onboarding-badge onboarding-badge--state ${isPaired ? 'is-live' : ''}`}>{pairingStateLabel}</span>
        </div>

        <p className="onboarding-overview__copy">
          Pairing uses a short-lived code from the client portal, grants access only to the selected host, and stores a
          revocable installation token inside extension-local storage. This screen exists only for pairing, re-pairing,
          and confirming the installed build.
        </p>

        <div className="onboarding-step-list" aria-label="Secure pairing steps">
          {onboardingSteps.map((step, index) => (
            <div key={step.title} className="onboarding-step-item">
              <div className="onboarding-step-item__rail" aria-hidden="true">
                <span className="onboarding-step-item__dot">
                  <Check size={14} strokeWidth={3} />
                </span>
                {index < onboardingSteps.length - 1 ? <span className="onboarding-step-item__line" /> : null}
              </div>

              <div className="onboarding-step-item__content">
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="onboarding-content">
        <section className="onboarding-panel onboarding-panel--glass">
          <header className="onboarding-panel__header">
            <p className="onboarding-kicker onboarding-kicker--muted">Pairing</p>
            <h2>Connect this browser to your client account</h2>
            <p>
              Grant permission for the app origin, then exchange the pairing code from the web portal. The browser keeps
              its own installation identity and can be revoked at any time.
            </p>
          </header>

          <div className="onboarding-state-row">
            <div className="onboarding-state-pill">
              <span>Installed build</span>
              <strong>{`v${extensionVersion}`}</strong>
            </div>
            <div className="onboarding-state-pill">
              <span>Current state</span>
              <strong>{summaryState}</strong>
            </div>
          </div>

          <div className="onboarding-form-grid">
            <label className="onboarding-field">
              <span>App URL</span>
              <input value={appBaseUrl} onChange={(event) => setAppBaseUrl(event.target.value)} spellCheck={false} />
            </label>

            <label className="onboarding-field">
              <span>Device Name</span>
              <input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} spellCheck={false} />
            </label>

            <label className="onboarding-field">
              <span>Pairing Code</span>
              <input value={pairingCode} onChange={(event) => setPairingCode(event.target.value.toUpperCase())} spellCheck={false} />
            </label>
          </div>

          <div className="onboarding-action-row">
            <button
              className="onboarding-button onboarding-button--secondary"
              onClick={() => void allowOrigin()}
              disabled={pending !== null}
            >
              <ScreenShare size={16} />
              <span>Request Connection Permission</span>
            </button>

            <button
              className="onboarding-button onboarding-button--primary"
              onClick={() => void pairExtension()}
              disabled={pending !== null || !pairingCode}
            >
              <Share size={16} />
              <span>Pair Extension</span>
            </button>
          </div>

          {statusMessage ? (
            <div className={`onboarding-status onboarding-status--${statusTone}`}>
              <strong>
                {statusTone === 'danger' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                <span>Status</span>
              </strong>
              <p>{statusMessage}</p>
            </div>
          ) : null}
        </section>

        <section className="onboarding-panel onboarding-panel--summary">
          <header className="onboarding-panel__header">
            <p className="onboarding-kicker onboarding-kicker--muted">Current extension state</p>
            <h2>Installation summary</h2>
            <p>Confirm the pairing status, connected app host, current device identity, and the next action for this browser.</p>
          </header>

          <div className="onboarding-summary-grid">
            {summaryItems.map((item) => {
              const Icon = item.icon;

              return (
                <article key={item.label} className="onboarding-summary-tile">
                  <div className={`onboarding-summary-tile__icon ${item.tone === 'success' ? 'is-success' : ''}`}>
                    <Icon size={18} />
                  </div>

                  <div className="onboarding-summary-tile__body">
                    <span>{item.label}</span>
                    <strong title={item.value}>{item.value}</strong>
                  </div>
                </article>
              );
            })}
          </div>

          <button className="onboarding-button onboarding-button--dashboard" onClick={() => void openDashboard()} disabled={pending !== null}>
            <Link2 size={16} />
            <span>Open Web Dashboard</span>
            <ArrowUpRight size={15} />
          </button>
        </section>
      </main>
    </div>
  );
}
