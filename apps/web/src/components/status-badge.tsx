import { cn } from '@study-assistant/ui';

const statusStyles: Record<string, string> = {
  completed: 'bg-green-50 text-green-700',
  succeeded: 'bg-green-50 text-green-700',
  active: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  processing: 'bg-blue-50 text-blue-700',
  failed: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  expired: 'bg-gray-100 text-gray-600',
  paused: 'bg-orange-50 text-orange-700',
  idle: 'bg-gray-100 text-gray-600',
};

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  const style = statusStyles[key] || 'bg-gray-100 text-gray-600';

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
