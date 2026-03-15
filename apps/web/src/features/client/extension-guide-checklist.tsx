'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, RefreshCw } from 'lucide-react';

import { useToast } from '@/components/providers/toast-provider';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress, cn } from '@study-assistant/ui';

type ManualChecklistState = {
  downloadedZip: boolean;
  extractedZip: boolean;
  openedExtensionsPage: boolean;
  loadedUnpacked: boolean;
  pinnedExtension: boolean;
};

const defaultChecklistState: ManualChecklistState = {
  downloadedZip: false,
  extractedZip: false,
  openedExtensionsPage: false,
  loadedUnpacked: false,
  pinnedExtension: false,
};

const manualStepLabels: Array<{
  key: keyof ManualChecklistState;
  title: string;
  description: string;
}> = [
  {
    key: 'downloadedZip',
    title: 'Downloaded the extension ZIP',
    description: 'You already saved the latest package from the portal.',
  },
  {
    key: 'extractedZip',
    title: 'Extracted the ZIP',
    description: 'The package was extracted into a normal folder before opening Chrome extensions.',
  },
  {
    key: 'openedExtensionsPage',
    title: 'Opened chrome://extensions',
    description: 'Developer mode is on and the extensions management page is open.',
  },
  {
    key: 'loadedUnpacked',
    title: 'Loaded the unpacked folder',
    description: 'Chrome accepted the extracted folder and the extension now appears in the list.',
  },
  {
    key: 'pinnedExtension',
    title: 'Pinned the extension',
    description: 'The extension icon is visible in the browser toolbar for quick access.',
  },
];

export function ExtensionGuideChecklist({
  userId,
  pairedDeviceCount,
  remainingSeconds,
  hasOpenSession,
}: {
  userId: string;
  pairedDeviceCount: number;
  remainingSeconds: number;
  hasOpenSession: boolean;
}) {
  const { pushToast } = useToast();
  const storageKey = `study-assistant:extension-guide:${userId}`;
  const [manualState, setManualState] = useState<ManualChecklistState>(defaultChecklistState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ManualChecklistState>;
        setManualState({
          ...defaultChecklistState,
          ...parsed,
        });
      }
    } catch {
      setManualState(defaultChecklistState);
    } finally {
      setReady(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(manualState));
  }, [manualState, ready, storageKey]);

  const derivedSteps = useMemo(
    () => [
      {
        id: 'paired',
        complete: pairedDeviceCount > 0,
        title: 'Browser paired to your account',
        description:
          pairedDeviceCount > 0
            ? `${pairedDeviceCount} active ${pairedDeviceCount === 1 ? 'browser is' : 'browsers are'} connected.`
            : 'Generate a pairing code and finish extension onboarding.',
      },
      {
        id: 'credits',
        complete: remainingSeconds > 0,
        title: 'Credits available',
        description:
          remainingSeconds > 0
            ? 'Your account has credits and can start a session.'
            : 'Buy credits before using Analyze Current Page.',
      },
      {
        id: 'session',
        complete: hasOpenSession,
        title: 'Session currently active',
        description: hasOpenSession
          ? 'A live session is already running.'
          : 'Start a session from the portal or extension when you are ready.',
      },
    ],
    [pairedDeviceCount, remainingSeconds, hasOpenSession],
  );

  const totalSteps = manualStepLabels.length + derivedSteps.length;
  const completeSteps =
    manualStepLabels.filter((step) => manualState[step.key]).length +
    derivedSteps.filter((step) => step.complete).length;
  const progress = Math.round((completeSteps / totalSteps) * 100);

  function toggleStep(key: keyof ManualChecklistState) {
    setManualState((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function resetChecklist() {
    setManualState(defaultChecklistState);
    pushToast({
      tone: 'info',
      title: 'Checklist reset',
      description: 'Manual install progress for this account was cleared in this browser.',
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Live setup checklist</CardTitle>
            <CardDescription>
              Manual steps are saved in this browser for your signed-in account. Account-derived steps update automatically.
            </CardDescription>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={resetChecklist}>
            <RefreshCw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3 rounded-[24px] border border-border/70 bg-background/50 p-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Progress</p>
              <p className="text-sm text-muted-foreground">
                {completeSteps} of {totalSteps} steps complete
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">{progress}%</p>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {manualStepLabels.map((step) => {
            const checked = manualState[step.key];

            return (
              <button
                key={step.key}
                type="button"
                onClick={() => toggleStep(step.key)}
                className={cn(
                  'rounded-[24px] border p-4 text-left transition',
                  checked
                    ? 'border-success/20 bg-success/5'
                    : 'border-border/70 bg-background/50 hover:border-accent/35 hover:bg-background/70',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('mt-0.5 flex h-6 w-6 items-center justify-center rounded-full', checked ? 'text-success' : 'text-muted-foreground')}>
                    {checked ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              </button>
            );
          })}

          {derivedSteps.map((step) => (
            <div
              key={step.id}
              className={cn(
                'rounded-[24px] border p-4',
                step.complete ? 'border-success/20 bg-success/5' : 'border-border/70 bg-background/50',
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('mt-0.5 flex h-6 w-6 items-center justify-center rounded-full', step.complete ? 'text-success' : 'text-muted-foreground')}>
                  {step.complete ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
