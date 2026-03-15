'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@study-assistant/ui';
import { Pencil, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

import { useToast } from '@/components/providers/toast-provider';

interface AdminCategoryActionsProps {
  categoryId: string;
  categoryName: string;
  isActive: boolean;
}

export function AdminCategoryActions({ categoryId, categoryName, isActive }: AdminCategoryActionsProps) {
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
            title: 'Edit category',
            description: `Scroll down to the category configuration form to edit "${categoryName}".`,
          });
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending !== null}
        className="gap-1.5"
        onClick={() => {
          const confirmed = window.confirm(
            isActive
              ? `Disable category "${categoryName}"?`
              : `Re-enable category "${categoryName}"?`,
          );
          if (!confirmed) return;

          runAction('toggle', async () => {
            const response = await fetch(`/api/admin/categories/${categoryId}/status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: isActive ? 'inactive' : 'active' }),
            });
            if (!response.ok) {
              const payload = await response.json() as { error?: string };
              throw new Error(payload.error ?? 'Status change failed.');
            }
            pushToast({
              tone: 'success',
              title: isActive ? 'Category disabled' : 'Category enabled',
              description: `"${categoryName}" status updated.`,
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
