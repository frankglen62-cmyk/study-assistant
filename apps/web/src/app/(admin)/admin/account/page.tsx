import Link from 'next/link';
import { Clock, KeyRound, Mail, Settings, ShieldCheck, User } from 'lucide-react';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';

import { PageHeading } from '@/components/page-heading';
import { LogoutButton } from '@/features/auth/logout-button';
import { MfaSecurityCard } from '@/features/auth/mfa';
import { requirePageUser } from '@/lib/auth/page-context';

export default async function AdminAccountPage() {
  const context = await requirePageUser(['admin', 'super_admin']);

  return (
    <div className="space-y-8 pb-12">
      <PageHeading
        eyebrow="Admin Account"
        title="Security & Account"
        description="Manage your administrator profile, password hygiene, and authenticator app before accessing platform controls."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/admin/settings">
                <Settings className="h-4 w-4" />
                Platform Settings
              </Link>
            </Button>
            <LogoutButton />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-6">
          <Card className="h-fit">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Profile Details</CardTitle>
                  <CardDescription>Your administrator identity and account status for this workspace.</CardDescription>
                </div>
                <Badge tone="accent" className="capitalize">
                  {context.profile.role.replace('_', ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 rounded-xl border border-border/50 bg-background/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                    <User className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{context.profile.full_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">Role: {context.profile.role.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{context.profile.email}</p>
                    <p className="text-xs text-muted-foreground">Primary sign-in address</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Account Status</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-success inline-block"></span>
                      {context.profile.account_status.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Admin access</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">Sensitive workspace</p>
                  <p className="mt-2 text-sm text-muted-foreground">Use MFA on this account before managing sources, users, payments, or audit logs.</p>
                </div>
                <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Password hygiene</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">12+ chars enforced</p>
                  <p className="mt-2 text-sm text-muted-foreground">Current auth rules now require mixed-case letters, digits, and symbols.</p>
                </div>
              </div>

              <Button asChild variant="secondary" className="w-full justify-start gap-2">
                <Link href="/forgot-password">
                  <KeyRound className="h-4 w-4" />
                  Change Password
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Security Reminder</CardTitle>
              <CardDescription>Admin accounts should finish MFA setup before routine work in the portal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3 rounded-[18px] border border-border/70 bg-background/40 px-4 py-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <p>Once an authenticator app is enabled, sign-ins to protected admin routes will be challenged for the 6-digit code automatically.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="secondary">
                  <Link href="/admin/dashboard">Back To Dashboard</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/admin/settings">Open Platform Settings</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <MfaSecurityCard />
      </div>
    </div>
  );
}
