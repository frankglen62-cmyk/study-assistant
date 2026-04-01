'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { startTransition, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { ClientSettings, ClientSettingsResponse } from '@study-assistant/shared-types';

import { FormField } from '@/components/forms/form-field';
import { useToast } from '@/components/providers/toast-provider';
import { clientSettingsDefaults, clientSettingsSchema, type ClientSettingsValues } from '@/features/client/settings';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@study-assistant/ui';

export function ClientSettingsForm({ initialSettings }: { initialSettings: ClientSettings }) {
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const { register, handleSubmit, reset, watch, formState } = useForm<ClientSettingsValues>({
    resolver: zodResolver(clientSettingsSchema),
    defaultValues: initialSettings,
  });

  const values = watch();
  const { errors } = formState;

  function handleReset() {
    reset(clientSettingsDefaults);
  }

  function handleSave(submitted: ClientSettingsValues) {
    startTransition(() => {
      void (async () => {
        setPending(true);

        try {
          const response = await fetch('/api/client/settings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(submitted),
          });

          const payload = (await response.json()) as Partial<ClientSettingsResponse> & { error?: string };
          if (!response.ok || !payload.settings) {
            throw new Error(payload.error ?? 'Settings update failed.');
          }

          reset(payload.settings);
          pushToast({
            tone: 'success',
            title: 'Settings saved',
            description: `Theme ${payload.settings.theme}, answer style ${payload.settings.answerStyle}.`,
          });
        } catch (error) {
          pushToast({
            tone: 'danger',
            title: 'Save failed',
            description: error instanceof Error ? error.message : 'Settings update failed.',
          });
        } finally {
          setPending(false);
        }
      })();
    });
  }

  return (
    <form
      className="space-y-8 pb-32"
      onSubmit={handleSubmit(handleSave)}
    >
      <div className="grid gap-6 xl:grid-cols-2">
        {/* AI & Session Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>AI Preferences</CardTitle>
            <CardDescription>Control how the AI assistant interprets and delivers results.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField label="Answer style" error={errors.answerStyle?.message}>
              <select
                className="h-11 w-full appearance-none rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20 cursor-pointer"
                {...register('answerStyle')}
              >
                <option value="concise">Concise & direct</option>
                <option value="detailed">Detailed & explanatory</option>
              </select>
            </FormField>
            <FormField label="Default detection mode" error={errors.detectionMode?.message}>
              <select
                className="h-11 w-full appearance-none rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20 cursor-pointer"
                {...register('detectionMode')}
              >
                <option value="auto">Automatic (seamless)</option>
                <option value="manual">Confirm first (preview)</option>
              </select>
            </FormField>
            <div className="flex items-center justify-between rounded-xl border border-border/40 bg-surface/30 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Show confidence scores</p>
                <p className="text-xs text-muted-foreground">Display AI certainty percentage on answer cards.</p>
              </div>
              <input type="checkbox" className="h-5 w-5 accent-accent rounded" {...register('showConfidence')} />
            </div>
          </CardContent>
        </Card>

        {/* General & Display */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General & Display</CardTitle>
              <CardDescription>Appearance and localization settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField label="Theme" error={errors.theme?.message}>
                <select className="h-11 w-full appearance-none rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20 cursor-pointer" {...register('theme')}>
                  <option value="system">System match</option>
                  <option value="light">Light mode</option>
                  <option value="dark">Dark mode</option>
                </select>
              </FormField>
              <FormField label="Language preference" error={errors.language?.message}>
                <Input {...register('language')} placeholder="e.g. English" />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Manage alerts and system messages.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-xl border border-border/40 bg-surface/30 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Low credit warnings</p>
                  <p className="text-xs text-muted-foreground">Get notified when balance implies less than 15 mins.</p>
                </div>
                <input type="checkbox" className="h-5 w-5 accent-accent rounded" {...register('lowCreditNotifications')} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-10 flex items-center justify-end gap-4 border-t border-border/40 bg-background/80 backdrop-blur-md px-6 py-4 shadow-soft-lg lg:left-[280px]">
        <p className="mr-auto text-xs text-muted-foreground hidden sm:block">
          Settings apply instantly to active sessions.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={handleReset} disabled={pending}>
          Reset Defaults
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </form>
  );
}
