'use client';

import { useState } from 'react';
import { Megaphone, Send, CheckCircle2, Loader2, Info, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';
import { useToast } from '@/components/providers/toast-provider';

const TONE_OPTIONS = [
  { value: 'info', label: 'Info', icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  { value: 'success', label: 'Success', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  { value: 'warning', label: 'Warning', icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  { value: 'danger', label: 'Urgent', icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
] as const;

type Tone = 'info' | 'success' | 'warning' | 'danger';

async function readJson<T>(res: Response) {
  return (await res.json()) as T & { error?: string };
}

export function AdminAnnouncementForm({ clientCount }: { clientCount: number }) {
  const { pushToast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<Tone>('info');
  const [lastResult, setLastResult] = useState<{ count: number; sentAt: string } | null>(null);

  async function sendAnnouncement() {
    if (!title.trim() || !message.trim()) {
      pushToast({ tone: 'warning', title: 'Missing fields', description: 'Enter both a title and a message.' });
      return;
    }

    setIsSending(true);
    setLastResult(null);

    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, tone }),
      });
      const data = await readJson<{ recipientCount: number; message: string }>(res);

      if (!res.ok) throw new Error(data.error ?? 'Failed to send.');

      setLastResult({ count: data.recipientCount, sentAt: new Date().toLocaleTimeString() });
      setTitle('');
      setMessage('');
      setTone('info');

      pushToast({ tone: 'success', title: 'Announcement sent', description: data.message });
    } catch (err) {
      pushToast({ tone: 'danger', title: 'Send failed', description: err instanceof Error ? err.message : 'Unknown error.' });
    } finally {
      setIsSending(false);
    }
  }

  const selectedTone = TONE_OPTIONS.find((t) => t.value === tone)!;
  const ToneIcon = selectedTone.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-accent" />
          Broadcast Announcement
        </CardTitle>
        <CardDescription>
          Send a message to all <strong className="text-foreground">{clientCount}</strong> active client{clientCount === 1 ? '' : 's'}.
          It will appear as a dismissible banner in their portal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Tone selector */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Message type</p>
          <div className="grid grid-cols-4 gap-2">
            {TONE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTone(opt.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all ${
                    tone === opt.value
                      ? `${opt.bg} ${opt.color} ring-1 ring-current/20`
                      : 'border-border/40 bg-surface/30 text-muted-foreground hover:border-border hover:text-foreground'
                  }`}
                >
                  <Icon size={16} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Title</label>
          <input
            type="text"
            placeholder="e.g. Platform update tonight at 10PM"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-background/60 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
          />
        </div>

        {/* Message */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Message</label>
          <textarea
            placeholder="Write the message clients will see in their dashboard..."
            value={message}
            maxLength={1000}
            rows={4}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 resize-none"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">{message.length}/1000</p>
        </div>

        {/* Preview */}
        {(title || message) && (
          <div className={`rounded-xl border p-4 ${selectedTone.bg}`}>
            <div className={`flex items-start gap-2.5 ${selectedTone.color}`}>
              <ToneIcon size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">{title || 'Preview title'}</p>
                <p className="text-xs mt-0.5 opacity-80">{message || 'Preview message...'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Last send result */}
        {lastResult && (
          <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-400">
              Sent to {lastResult.count} client{lastResult.count === 1 ? '' : 's'} at {lastResult.sentAt}
            </p>
          </div>
        )}

        <Button
          onClick={() => void sendAnnouncement()}
          disabled={isSending || !title.trim() || !message.trim()}
          className="w-full"
        >
          {isSending ? (
            <><Loader2 size={16} className="animate-spin" /> Sending...</>
          ) : (
            <><Send size={16} /> Send to All Clients</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
