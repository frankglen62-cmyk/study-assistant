import type { ReactNode } from 'react';
import { Card } from '@study-assistant/ui';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="rounded-[32px] border-dashed bg-muted/35 text-center">
      <div className="mx-auto max-w-md space-y-3 py-8">
        <h3 className="font-display text-xl font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </Card>
  );
}
