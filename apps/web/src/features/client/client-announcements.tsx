'use client';

import { useState } from 'react';
import { Megaphone, X, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Announcement {
  id: string;
  title: string;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
}

const TONE_STYLES = {
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  success: 'bg-green-500/10 border-green-500/20 text-green-400',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  danger: 'bg-red-500/10 border-red-500/20 text-red-400',
};

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

export function ClientAnnouncements({ announcements }: { announcements: Announcement[] }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  async function handleDismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    try {
      await fetch(`/api/client/announcements/${id}/dismiss`, { method: 'POST' });
      router.refresh();
    } catch {
      // Ignore errors for dismissals
    }
  }

  const visible = announcements.filter((a) => !dismissed.has(a.id));

  if (visible.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {visible.map((announcement) => {
        const Icon = ICONS[announcement.tone] || Megaphone;
        const style = TONE_STYLES[announcement.tone] || TONE_STYLES.info;

        return (
          <div
            key={announcement.id}
            className={`relative rounded-2xl border p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 ${style}`}
          >
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 opacity-80" />
              <div className="flex-1 pr-6">
                <h3 className="text-sm font-bold tracking-wide mb-1">{announcement.title}</h3>
                <p className="text-sm opacity-90 leading-relaxed">{announcement.message}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDismiss(announcement.id)}
                className="absolute right-3 top-3 rounded-xl p-1.5 opacity-60 hover:bg-black/10 hover:opacity-100 transition-all text-inherit"
                title="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
