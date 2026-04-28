import { ChevronRight, Download, FolderOpen, Sparkles } from 'lucide-react';

import { Button } from '@study-assistant/ui';

import { PageHeading } from '@/components/page-heading';
import { ExtensionFleetTable } from '@/features/admin/extension-fleet-table';
import { ExtensionChangelogPanel } from '@/features/client/extension-changelog-panel';
import { ExtensionInstallSteps } from '@/features/client/extension-install-steps';
import { requirePageUser } from '@/lib/auth/page-context';
import {
  extensionDownloadFileName,
  extensionDownloadPath,
  extensionPackageUpdatedAt,
  extensionVersion,
} from '@/lib/extension-distribution';
import { listAllExtensionInstallations } from '@/lib/supabase/admin';

export default async function AdminExtensionGuidePage() {
  await requirePageUser(['admin', 'super_admin']);
  const installations = await listAllExtensionInstallations({ limit: 500 });

  const packageDateLabel = new Date(extensionPackageUpdatedAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-6 pb-12">
      <PageHeading
        eyebrow="Chrome Extension"
        title="Extension fleet"
        description={`Monitor adoption of v${extensionVersion} across every paired browser. Filter to outdated installs to identify users who need to update.`}
        badge="Admin Area"
        actions={
          <>
            <Button asChild>
              <a href={extensionDownloadPath} download={extensionDownloadFileName}>
                <Download className="h-4 w-4" />
                {`Download ZIP v${extensionVersion}`}
              </a>
            </Button>
          </>
        }
      />

      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Latest build: v{extensionVersion}
              </p>
              <p className="text-sm text-muted-foreground">
                Packaged {packageDateLabel}. Roll it out to anyone behind by sharing the install
                steps below.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ExtensionFleetTable rows={installations} currentZipVersion={extensionVersion} />

      <details className="group rounded-2xl border border-border/40 bg-background shadow-card">
        <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 text-sm font-medium text-foreground">
          <span className="inline-flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            Install on my own browser (3 steps)
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
        </summary>
        <div className="border-t border-border/40 p-1">
          <ExtensionInstallSteps
            heading="Install in 3 simple steps"
            subheading="Same flow that clients see — useful when you want to test pairing on your own browser."
          />
        </div>
      </details>

      <ExtensionChangelogPanel />
    </div>
  );
}
