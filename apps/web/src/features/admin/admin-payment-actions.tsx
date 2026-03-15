'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@study-assistant/ui';
import { Eye, CheckCircle, Undo2 } from 'lucide-react';

import { useToast } from '@/components/providers/toast-provider';

interface AdminPaymentActionsProps {
  paymentId: string;
  status: string;
}

export function AdminPaymentActions({ paymentId, status }: AdminPaymentActionsProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState<string | null>(null);

  function runAction(action: string, callback: () => Promise<void>) {
    startTransition(() => {
      void (async () => {
        setPending(action);
        try {
          await callback();
          router.refresh();
        } catch (error) {
          pushToast({
            tone: 'danger',
            title: 'Action failed',
            description: error instanceof Error ? error.message : 'Unknown error.',
          });
        } finally {
          setPending(null);
        }
      })();
    });
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending !== null}
        className="gap-1.5"
        onClick={() => {
          pushToast({
            tone: 'info',
            title: 'Payment details',
            description: `Payment ${paymentId.slice(0, 8)}... — Status: ${status}. Full detail view coming soon.`,
          });
        }}
      >
        <Eye className="h-3.5 w-3.5" />
        {pending === 'view' ? 'Loading...' : 'View'}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending !== null || status === 'reviewed'}
        className="gap-1.5"
        onClick={() => {
          runAction('review', async () => {
            const response = await fetch(`/api/admin/payments/${paymentId}/review`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) {
              const payload = await response.json() as { error?: string };
              throw new Error(payload.error ?? 'Mark reviewed failed.');
            }
            pushToast({
              tone: 'success',
              title: 'Marked as reviewed',
              description: `Payment ${paymentId.slice(0, 8)}... has been reviewed.`,
            });
          });
        }}
      >
        <CheckCircle className="h-3.5 w-3.5" />
        {pending === 'review' ? 'Saving...' : 'Reviewed'}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending !== null || status === 'refunded'}
        className="gap-1.5"
        onClick={() => {
          const confirmed = window.confirm('Are you sure you want to refund this payment? This action cannot be undone.');
          if (!confirmed) return;

          runAction('refund', async () => {
            const response = await fetch(`/api/admin/payments/${paymentId}/refund`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) {
              const payload = await response.json() as { error?: string };
              throw new Error(payload.error ?? 'Refund failed.');
            }
            pushToast({
              tone: 'warning',
              title: 'Payment refunded',
              description: `Payment ${paymentId.slice(0, 8)}... has been refunded.`,
            });
          });
        }}
      >
        <Undo2 className="h-3.5 w-3.5" />
        {pending === 'refund' ? 'Refunding...' : 'Refund'}
      </Button>
    </div>
  );
}
