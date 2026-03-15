'use client';

import { Chrome, Copy, FolderOpen, Link2 } from 'lucide-react';

import { useToast } from '@/components/providers/toast-provider';
import { extensionManifestFileName } from '@/lib/extension-distribution';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';

export function ExtensionInstallHelper({ appBaseUrl }: { appBaseUrl: string }) {
  const { pushToast } = useToast();

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      pushToast({
        tone: 'success',
        title: `${label} copied`,
        description: 'Paste it where needed during install or pairing.',
      });
    } catch {
      pushToast({
        tone: 'warning',
        title: `Could not copy ${label.toLowerCase()}`,
        description: 'Copy it manually instead.',
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick install helper</CardTitle>
        <CardDescription>
          Keep these exact values nearby while installing the ZIP build and pairing the browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[24px] border border-border/70 bg-background/50 p-4">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Chrome className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-foreground">Chrome extensions page</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Copy this and paste it into Chrome&apos;s address bar manually. Websites cannot reliably open internal
            Chrome pages for you.
          </p>
          <div className="mt-4 flex gap-2">
            <code className="flex-1 rounded-2xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground">
              chrome://extensions
            </code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void copyValue('chrome://extensions', 'chrome://extensions')}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-[24px] border border-border/70 bg-background/50 p-4">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Link2 className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-foreground">App URL for pairing</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Use this exact portal URL inside the extension onboarding screen so the browser talks to the correct app
            origin.
          </p>
          <div className="mt-4 flex gap-2">
            <code className="flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground">
              {appBaseUrl}
            </code>
            <Button type="button" variant="secondary" size="sm" onClick={() => void copyValue(appBaseUrl, 'App URL')}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-[24px] border border-warning/20 bg-warning/10 p-4">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-warning/15 text-warning">
            <FolderOpen className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-foreground">Correct folder warning</p>
          <p className="mt-2 text-sm text-muted-foreground">
            After extracting the ZIP, choose the folder that contains
            <span className="mx-1 font-mono text-foreground">{extensionManifestFileName}</span>
            directly inside it. Do not select the ZIP itself or a parent folder above it.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
