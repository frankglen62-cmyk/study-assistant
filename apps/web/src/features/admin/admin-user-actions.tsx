'use client';

import Link from 'next/link';
import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@study-assistant/ui';

import { useToast } from '@/components/providers/toast-provider';

interface AdminUserActionsProps {
  userId: string;
  accountStatus: 'active' | 'suspended' | 'pending_verification' | 'banned';
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T & { error?: string };
}

export function AdminUserActions({ userId, accountStatus }: AdminUserActionsProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const mayAdjustStatus = accountStatus === 'active' || accountStatus === 'suspended';
  const mayAdjustCredits = accountStatus !== 'banned';

  function runAction(action: string, callback: () => Promise<void>) {
    startTransition(() => {
      void (async () => {
        setPendingAction(action);

        try {
          await callback();
          router.refresh();
        } catch (error) {
          pushToast({
            tone: 'danger',
            title: 'Admin action failed',
            description: error instanceof Error ? error.message : 'Unknown error.',
          });
        } finally {
          setPendingAction(null);
        }
      })();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={pendingAction !== null || !mayAdjustCredits}
        onClick={() => {
          const rawMinutes = window.prompt('Add how many minutes?', '60');
          if (!rawMinutes) {
            return;
          }

          const minutes = Number.parseInt(rawMinutes, 10);
          if (!Number.isFinite(minutes) || minutes <= 0) {
            pushToast({
              tone: 'warning',
              title: 'Invalid adjustment',
              description: 'Enter a positive number of minutes.',
            });
            return;
          }

          runAction('add', async () => {
            const response = await fetch(`/api/admin/users/${userId}/credits`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                deltaSeconds: minutes * 60,
                description: `Admin credit adjustment +${minutes} minutes`,
              }),
            });
            const payload = await readJson<{ message: string }>(response);
            if (!response.ok) {
              throw new Error(payload.error ?? 'Credit adjustment failed.');
            }

            pushToast({
              tone: 'success',
              title: 'Credits added',
              description: payload.message,
            });
          });
        }}
      >
        {pendingAction === 'add' ? 'Adding...' : 'Add Credits'}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={pendingAction !== null || !mayAdjustCredits}
        onClick={() => {
          const rawMinutes = window.prompt('Deduct how many minutes?', '30');
          if (!rawMinutes) {
            return;
          }

          const minutes = Number.parseInt(rawMinutes, 10);
          if (!Number.isFinite(minutes) || minutes <= 0) {
            pushToast({
              tone: 'warning',
              title: 'Invalid adjustment',
              description: 'Enter a positive number of minutes.',
            });
            return;
          }

          runAction('deduct', async () => {
            const response = await fetch(`/api/admin/users/${userId}/credits`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                deltaSeconds: minutes * -60,
                description: `Admin credit adjustment -${minutes} minutes`,
              }),
            });
            const payload = await readJson<{ message: string }>(response);
            if (!response.ok) {
              throw new Error(payload.error ?? 'Credit deduction failed.');
            }

            pushToast({
              tone: 'success',
              title: 'Credits deducted',
              description: payload.message,
            });
          });
        }}
      >
        {pendingAction === 'deduct' ? 'Deducting...' : 'Deduct Credits'}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={pendingAction !== null || !mayAdjustStatus}
        onClick={() => {
          runAction('status', async () => {
            const nextStatus = accountStatus === 'active' ? 'suspended' : 'active';
            const confirmed = window.confirm(
              accountStatus === 'active'
                ? 'Suspend this account and lock the wallet?'
                : 'Reactivate this account and unlock the wallet?',
            );

            if (!confirmed) {
              return;
            }

            const response = await fetch(`/api/admin/users/${userId}/status`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                status: nextStatus,
              }),
            });
            const payload = await readJson<{ message: string }>(response);
            if (!response.ok) {
              throw new Error(payload.error ?? 'Status change failed.');
            }

            pushToast({
              tone: 'success',
              title: nextStatus === 'active' ? 'User reactivated' : 'User suspended',
              description: payload.message,
            });
          });
        }}
      >
        {pendingAction === 'status' ? 'Saving...' : accountStatus === 'active' ? 'Suspend' : 'Reactivate'}
      </Button>
      <Link href={`/admin/users/${userId}/sessions`}>
        <Button size="sm" variant="secondary" disabled={pendingAction !== null}>
          View Sessions
        </Button>
      </Link>
    </div>
  );
}
