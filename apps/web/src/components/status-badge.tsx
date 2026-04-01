import { cn } from '@study-assistant/ui';

const statusStyles: Record<string, string> = {
  completed: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  succeeded: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  processing: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  failed: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400',
  expired: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400',
  paused: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
  idle: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400',
};

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  const style = statusStyles[key] || 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize',
        style,
      )}
    >
      {status}
    </span>
  );
}
