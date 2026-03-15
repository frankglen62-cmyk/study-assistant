'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@study-assistant/ui';
import { Pencil, ToggleLeft, ToggleRight } from 'lucide-react';

import { useToast } from '@/components/providers/toast-provider';

interface AdminSubjectActionsProps {
  subjectId: string;
  subjectName: string;
  isActive: boolean;
}

export function AdminSubjectActions({ subjectId, subjectName, isActive }: AdminSubjectActionsProps) {
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
            title: 'Edit subject',
            description: `Scroll down to the subject configuration form to edit "${subjectName}".`,
          });
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
        {pending === 'edit' ? 'Opening...' : 'Edit'}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending !== null}
        className="gap-1.5"
        onClick={() => {
          const nextStatus = isActive ? 'inactive' : 'active';
          const confirmed = window.confirm(
            isActive
              ? `Disable subject "${subjectName}"? Detection rules will stop matching.`
              : `Re-enable subject "${subjectName}"? Detection will resume.`,
          );
          if (!confirmed) return;

          runAction('toggle', async () => {
            const response = await fetch(`/api/admin/subjects/${subjectId}/status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: nextStatus }),
            });
            if (!response.ok) {
              const payload = await response.json() as { error?: string };
              throw new Error(payload.error ?? 'Status change failed.');
            }
            pushToast({
              tone: 'success',
              title: isActive ? 'Subject disabled' : 'Subject enabled',
              description: `"${subjectName}" is now ${nextStatus}.`,
            });
          });
        }}
      >
        {isActive ? <ToggleLeft className="h-3.5 w-3.5" /> : <ToggleRight className="h-3.5 w-3.5" />}
        {pending === 'toggle' ? 'Saving...' : isActive ? 'Disable' : 'Enable'}
      </Button>
    </div>
  );
}
