import { AlertTriangle, Download, FolderOpen, Link2 } from 'lucide-react';

import { extensionManifestFileName } from '@/lib/extension-distribution';

const setupSteps = [
  {
    label: 'Step 1',
    title: 'Download the latest ZIP',
    description:
      'Save the package to a known folder. Always install from the latest build only — older ZIPs may break pairing.',
    icon: Download,
  },
  {
    label: 'Step 2',
    title: 'Load it in Chrome',
    description: `Extract the ZIP first, open chrome://extensions, enable Developer mode (top right), then click Load unpacked and choose the folder that contains ${extensionManifestFileName}.`,
    icon: FolderOpen,
  },
  {
    label: 'Step 3',
    title: 'Pair this browser',
    description:
      'Use the Pairing Mode card on this page to copy the app URL and a short-lived code, then paste them into the extension onboarding screen.',
    icon: Link2,
  },
] as const;

function ChromeExtensionsIllustration() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/40 bg-surface/40 p-4 shadow-soft-sm">
      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 flex-1 truncate rounded-md bg-surface px-3 py-1 font-mono text-[11px] text-muted-foreground">
          chrome://extensions
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-border/40 bg-background px-3 py-2.5">
        <span className="text-xs font-medium text-foreground">Developer mode</span>
        <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-emerald-500 px-0.5">
          <span className="ml-auto h-4 w-4 rounded-full bg-white shadow-sm" />
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-md border border-emerald-300/70 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
          Load unpacked
        </span>
        <span className="rounded-md border border-border/40 bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Pack extension
        </span>
        <span className="rounded-md border border-border/40 bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Update
        </span>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Click <span className="font-semibold text-foreground">Load unpacked</span>, then pick the
        extracted folder containing <span className="font-mono">{extensionManifestFileName}</span>.
      </p>
    </div>
  );
}

interface ExtensionInstallStepsProps {
  heading?: string;
  subheading?: string;
}

export function ExtensionInstallSteps({
  heading = 'Install in 3 simple steps',
  subheading = 'This is the only install flow that matters. Everything else is optional.',
}: ExtensionInstallStepsProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/40 bg-background shadow-card">
      <div className="border-b border-border/40 px-6 py-5">
        <h3 className="text-base font-semibold text-foreground">{heading}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{subheading}</p>
      </div>
      <div className="space-y-4 p-6">
        {setupSteps.map((step) => {
          const Icon = step.icon;
          const isLoadStep = step.label === 'Step 2';
          return (
            <div
              key={step.label}
              className="rounded-xl border border-border/40 bg-surface/40 p-5 transition-all hover:shadow-soft-sm dark:bg-surface"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-medium text-accent">{step.label}</p>
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {isLoadStep ? (
                <div className="mt-4 pl-16">
                  <ChromeExtensionsIllustration />
                </div>
              ) : null}
            </div>
          );
        })}

        <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                Important folder reminder
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-200/90">
                When Chrome asks for a folder, select the extracted folder where{' '}
                <span className="font-mono text-amber-900 dark:text-amber-300">
                  {extensionManifestFileName}
                </span>{' '}
                is directly visible. Do not select the ZIP file itself or a parent folder above it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
