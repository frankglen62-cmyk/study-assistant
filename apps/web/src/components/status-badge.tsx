import { cn } from '@study-assistant/ui';

const statusStyles: Record<string, string> = {
  completed: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  succeeded: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  paid: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  suspended: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  banned: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  pending_verification: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  processing: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  failed: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  refunded: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
  canceled: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400',
  expired: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400',
  paused: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
  timed_out: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
  no_credit: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  no_match: 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300',
  idle: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400',
  locked: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  revoked: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  const style = statusStyles[key] || 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400';
  const label = status.replaceAll('_', ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize',
        style,
      )}
    >
      {label}
    </span>
  );
}
