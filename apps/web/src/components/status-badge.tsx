import { Badge } from '@study-assistant/ui';

const statusToneMap: Record<string, 'accent' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  paid: 'success',
  ready: 'success',
  resolved: 'success',
  processing: 'warning',
  pending: 'warning',
  paused: 'warning',
  low_confidence: 'warning',
  refunded: 'warning',
  no_credit: 'warning',
  no_match: 'warning',
  timed_out: 'warning',
  pending_verification: 'warning',
  failed: 'danger',
  suspended: 'danger',
  banned: 'danger',
  locked: 'danger',
  archived: 'neutral',
  draft: 'neutral',
  ended: 'neutral',
  revoked: 'neutral',
  canceled: 'neutral',
  in_progress: 'neutral',
  closed: 'neutral',
};

export function StatusBadge({ status }: { status: string }) {
  const tone = statusToneMap[status] ?? 'neutral';
  const label = status.replace(/_/g, ' ');

  return <Badge tone={tone}>{label}</Badge>;
}
