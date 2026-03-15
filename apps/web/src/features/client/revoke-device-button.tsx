'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@study-assistant/ui';

import { useToast } from '@/components/providers/toast-provider';

export function RevokeDeviceButton({ installationId }: { installationId: string }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);

  function handleRevoke() {
    if (!window.confirm('Revoke this extension device? It will need to be paired again before it can make future requests.')) {
      return;
    }

    startTransition(() => {
      void (async () => {
        setPending(true);

        try {
          const response = await fetch('/api/client/devices/revoke', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              installationId,
            }),
          });

          if (!response.ok) {
            const payload = (await response.json()) as { error?: string };
            throw new Error(payload.error ?? 'Device revoke failed.');
          }

          pushToast({
            tone: 'success',
            title: 'Device revoked',
            description: 'Future extension API calls from this device will now be rejected.',
          });
          router.refresh();
        } catch (error) {
          pushToast({
            tone: 'danger',
            title: 'Revoke failed',
            description: error instanceof Error ? error.message : 'Device revoke failed.',
          });
        } finally {
          setPending(false);
        }
      })();
    });
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleRevoke} disabled={pending}>
      {pending ? 'Revoking...' : 'Revoke Device'}
    </Button>
  );
}
