import { useEffect, useMemo, useState } from 'react';

import type { ReactNode } from 'react';
import type { ExtensionState } from '@study-assistant/shared-types';
import { normalizeOriginPattern } from '@study-assistant/shared-utils';
import { Sparkles, Plug, Link as LinkIcon, AlertTriangle, ScreenShare, Share, CheckCircle2, Copy } from 'lucide-react';

import type { PairExtensionPayload } from '../lib/messages';
import { getStoredExtensionState, sendExtensionMessage, subscribeToExtensionState } from '../lib/runtime';
import { getExtensionVersion } from '../lib/auth';

const onboardingSteps = [
  { text: 'Enter the base URL for your deployed web app or local development app.', icon: LinkIcon },
  { text: 'Grant the extension permission for that app origin only.', icon: ShieldCheckIcon },
  { text: 'Paste the short-lived pairing code from the client portal.', icon: Copy },
  { text: 'Finish pairing and open the dashboard to verify the installation.', icon: CheckCircle2 },
];

function ShieldCheckIcon(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2-1 4-2 7-2 2.5 0 4.5 1 6.5 2a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

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

export function OnboardingApp() {
  const state = useOnboardingState();
  const extensionVersion = useMemo(() => getExtensionVersion(), []);
  const [appBaseUrl, setAppBaseUrl] = useState('https://study-assistant-web.vercel.app');
  const [pairingCode, setPairingCode] = useState('');
  const [deviceName, setDeviceName] = useState('My Study Device');
  const [statusMessage, setStatusMessage] = useState('Enter your app URL and pairing code to continue.');
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
  }, [state]);

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

  return (
    <div className="onboarding-shell">
      <aside className="onboarding-hero">
        <div className="onboarding-hero__brand">
          <div className="onboarding-hero__logo"><Sparkles strokeWidth={2.5} size={24} /></div>
          <div>
            <p className="onboarding-hero__eyebrow">Chrome extension</p>
            <h1>Pair the Study Assistant safely.</h1>
          </div>
        </div>
        <div className="onboarding-version-strip">
          <span className="onboarding-chip onboarding-chip--accent">{`Extension v${extensionVersion}`}</span>
          <span className="onboarding-chip">
            {state?.pairingStatus === 'paired' ? 'Paired and ready' : 'Pairing required'}
          </span>
        </div>
        <p className="onboarding-hero__copy">
          The extension does not rely on shared browser cookies. Pairing uses a short-lived code from the client portal and
          stores a revocable installation token in extension-local storage.
        </p>
        <div className="onboarding-callout">
          <strong>You are viewing the onboarding screen.</strong>
          <p>
            The redesigned analysis UI appears in the extension side panel after pairing. Use this screen only to pair or re-pair the browser and confirm the installed version.
          </p>
        </div>
        <div className="onboarding-steps">
          {onboardingSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="onboarding-step">
                <div className="step-icon-wrapper"><Icon size={16} /></div>
                <p>{step.text}</p>
              </div>
            );
          })}
        </div>
      </aside>

      <main className="onboarding-main">
        <section className="onboarding-card">
          <header>
            <p className="eyebrow flex items-center gap-1.5"><Plug size={14} /> Pairing</p>
            <h2>Connect this browser to your client account</h2>
            <p>Grant permission for the app origin, then exchange the pairing code from the web portal.</p>
          </header>

          <div className="onboarding-meta-row">
            <div className="onboarding-meta-pill">
              <span>Installed build</span>
              <strong>{`v${extensionVersion}`}</strong>
            </div>
            <div className="onboarding-meta-pill">
              <span>Current state</span>
              <strong>{state?.pairingStatus ?? 'loading'}</strong>
            </div>
          </div>

          <div className="onboarding-form">
            <label>
              <span>App URL <span className="text-muted-foreground text-xs font-normal ml-1">(Where is your portal hosted?)</span></span>
              <input value={appBaseUrl} onChange={(event) => setAppBaseUrl(event.target.value)} placeholder="https://app.example.com" />
            </label>
            <label>
              <span>Device name</span>
              <input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="MacBook Pro - Chrome" />
            </label>
            <label>
              <span>Pairing code</span>
              <input value={pairingCode} onChange={(event) => setPairingCode(event.target.value)} placeholder="Enter your short-lived code" />
            </label>
          </div>

          <div className="onboarding-actions">
            <button className="onboarding-button onboarding-button--secondary flex items-center justify-center gap-2" onClick={() => void allowOrigin()} disabled={pending !== null}>
              <ScreenShare size={16} /> Request Connection Permission
            </button>
            <button className="onboarding-button onboarding-button--primary flex items-center justify-center gap-2" onClick={() => void pairExtension()} disabled={pending !== null || !pairingCode}>
              <Share size={16} /> Pair Extension
            </button>
          </div>

          {statusMessage && (
            <div className={`onboarding-status ${statusMessage.includes('successful') || statusMessage.includes('granted') ? 'bg-success/10 border-success/20 text-success' : statusMessage.includes('failed') ? 'bg-danger/10 border-danger/20 text-danger' : ''}`}>
              <strong className="flex items-center gap-1.5">
                {statusMessage.includes('failed') ? <AlertTriangle size={14} /> : statusMessage.includes('successful') ? <CheckCircle2 size={14} /> : null}
                Status
              </strong>
              <p>{statusMessage}</p>
            </div>
          )}
        </section>

        <section className="onboarding-card">
          <header>
            <p className="eyebrow">Current extension state</p>
            <h2>Installation summary</h2>
            <p>Use this view to confirm the extension is paired, connected, and ready for session use.</p>
          </header>

          <div className="summary-grid">
            <div className="summary-tile">
              <span>Pairing Status</span>
              <strong className={state?.pairingStatus === 'paired' ? 'text-success' : 'text-warning'}>
                {state?.pairingStatus ?? 'Loading'}
              </strong>
            </div>
            <div className="summary-tile">
              <span>App Host</span>
              <strong className="truncate" title={state?.appBaseUrl}>{state?.appBaseUrl || 'Not configured'}</strong>
            </div>
            <div className="summary-tile">
              <span>Device Name</span>
              <strong className="truncate" title={state?.deviceName ?? deviceName}>{state?.deviceName ?? deviceName}</strong>
            </div>
            <div className="summary-tile">
              <span>Extension Target</span>
              <strong>{state?.browserName ?? 'Unknown'}</strong>
            </div>
            <div className="summary-tile">
              <span>Installed Build</span>
              <strong>{`v${extensionVersion}`}</strong>
            </div>
            <div className="summary-tile">
              <span>Next Step</span>
              <strong>{state?.pairingStatus === 'paired' ? 'Open side panel' : 'Finish pairing'}</strong>
            </div>
          </div>
          
          <div className="mt-6 pt-5 border-t border-border/50">
             <button className="onboarding-button w-full flex items-center justify-center gap-2" onClick={() => void openDashboard()} disabled={pending !== null}>
              <LinkIcon size={16} /> Open Web Dashboard
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
