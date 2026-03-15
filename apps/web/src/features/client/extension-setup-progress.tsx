import { formatDuration } from '@study-assistant/shared-utils';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@study-assistant/ui';
import { CheckCircle2, Clock3, CreditCard, FolderOpen, Link2, PlayCircle } from 'lucide-react';

type ProgressState = 'complete' | 'manual' | 'action';

function stateClasses(state: ProgressState) {
  if (state === 'complete') {
    return {
      badge: 'bg-success/12 text-success',
      iconWrap: 'bg-success/12 text-success',
      border: 'border-success/20',
      label: 'Complete',
    };
  }

  if (state === 'action') {
    return {
      badge: 'bg-warning/12 text-warning',
      iconWrap: 'bg-warning/12 text-warning',
      border: 'border-warning/20',
      label: 'Action needed',
    };
  }

  return {
    badge: 'bg-accent/12 text-accent',
    iconWrap: 'bg-accent/12 text-accent',
    border: 'border-accent/20',
    label: 'Manual step',
  };
}

export function ExtensionSetupProgress({
  pairedDeviceCount,
  remainingSeconds,
  hasOpenSession,
}: {
  pairedDeviceCount: number;
  remainingSeconds: number;
  hasOpenSession: boolean;
}) {
  const steps = [
    {
      key: 'loaded',
      title: 'Load the extension in Chrome',
      description:
        pairedDeviceCount > 0
          ? 'At least one browser is already paired, so the unpacked install step has been completed before.'
          : 'Download the ZIP, extract it, then use Load unpacked in chrome://extensions.',
      state: pairedDeviceCount > 0 ? 'complete' : 'manual',
      icon: FolderOpen,
    },
    {
      key: 'paired',
      title: 'Pair the browser with your account',
      description:
        pairedDeviceCount > 0
          ? `${pairedDeviceCount} active ${pairedDeviceCount === 1 ? 'device is' : 'devices are'} already connected to your account.`
          : 'Generate a short-lived code and paste it into the extension onboarding screen.',
      state: pairedDeviceCount > 0 ? 'complete' : 'action',
      icon: Link2,
    },
    {
      key: 'credits',
      title: 'Keep credits available',
      description:
        remainingSeconds > 0
          ? `Current balance: ${formatDuration(remainingSeconds)} available for session usage and analysis.`
          : 'Buy credits before starting a session or analyzing a page.',
      state: remainingSeconds > 0 ? 'complete' : 'action',
      icon: CreditCard,
    },
    {
      key: 'session',
      title: 'Start a session when ready',
      description: hasOpenSession
        ? 'An active session is already open. The extension can analyze the current page immediately.'
        : 'Once pairing is done, start a session from the portal or extension side panel.',
      state: hasOpenSession ? 'complete' : pairedDeviceCount > 0 && remainingSeconds > 0 ? 'manual' : 'action',
      icon: PlayCircle,
    },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Setup progress</CardTitle>
            <CardDescription>
              This section reflects what the portal can already infer from your current account state.
            </CardDescription>
          </div>
          <Badge tone={pairedDeviceCount > 0 ? 'success' : 'warning'}>
            <Clock3 className="h-3.5 w-3.5" />
            {pairedDeviceCount > 0 ? 'Partially verified' : 'Needs setup'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-2">
        {steps.map((step) => {
          const Icon = step.icon;
          const styles = stateClasses(step.state);

          return (
            <div
              key={step.key}
              className={cn('rounded-[24px] border bg-background/50 p-4', styles.border)}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', styles.iconWrap)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  </div>
                </div>
                <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', styles.badge)}>
                  {styles.label}
                </span>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
