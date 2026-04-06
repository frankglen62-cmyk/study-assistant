import Link from 'next/link';
import { Wrench, ShieldAlert } from 'lucide-react';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@study-assistant/ui';

import { getSystemSettings } from '@/lib/platform/system-settings';

export const dynamic = 'force-dynamic';

export default async function MaintenancePage() {
  const settings = await getSystemSettings();

  return (
    <section className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-4xl items-center px-6 py-20">
      <Card className="w-full border-amber-300/40 bg-white/90 shadow-soft-lg">
        <CardHeader className="space-y-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Wrench className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Maintenance Mode</p>
            <CardTitle className="font-display text-4xl text-foreground">Client access is temporarily paused</CardTitle>
            <p className="max-w-2xl text-base text-muted-foreground">{settings.maintenanceMessage}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-2xl border border-border/60 bg-surface/50 p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700" />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  The portal and extension are locked for client accounts while updates are being applied. Open sessions
                  and new checkout attempts will resume once maintenance mode is turned off by the admin team.
                </p>
                <p>
                  Need help right now? Contact <span className="font-medium text-foreground">{settings.supportEmail}</span>.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/">Back to Homepage</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/login">Try Sign In Later</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
