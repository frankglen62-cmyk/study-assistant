import { PageHeading } from '@/components/page-heading';
import { requirePageUser } from '@/lib/auth/page-context';
import { AdminAnnouncementForm } from '@/features/admin/admin-announcement-form';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { Bell, Megaphone, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getAnnouncementStats() {
  const supabase = getSupabaseAdmin();
  const [clientsRes, recentRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'client')
      .eq('account_status', 'active'),
    supabase
      .from('notifications')
      .select('id, title, message, tone, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return {
    activeClientCount: clientsRes.count ?? 0,
    recent: recentRes.data ?? [],
  };
}

const TONE_STYLES: Record<string, string> = {
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  success: 'bg-green-500/10 border-green-500/20 text-green-400',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  danger: 'bg-red-500/10 border-red-500/20 text-red-400',
};

export default async function AdminAnnouncementsPage() {
  await requirePageUser(['admin', 'super_admin']);
  const { activeClientCount, recent } = await getAnnouncementStats();

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow="Communications"
        title="Announcements"
        description="Broadcast messages to all active clients. Messages appear as banners in their portal dashboard."
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        {/* Broadcaster */}
        <div className="space-y-6">
          <AdminAnnouncementForm clientCount={activeClientCount} />
        </div>

        {/* Recent announcements */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Recent Broadcasts</h2>
            <span className="ml-auto text-xs text-muted-foreground">{recent.length} shown</span>
          </div>

          {recent.length === 0 ? (
            <div className="rounded-2xl border border-border/40 bg-background p-10 text-center">
              <Megaphone className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No announcements sent yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recent.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 ${TONE_STYLES[item.tone] ?? TONE_STYLES.info}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold truncate">{item.title}</p>
                    <span className="flex-shrink-0 text-xs opacity-60">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs opacity-70 line-clamp-2">{item.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Stats card */}
          <div className="rounded-2xl border border-border/40 bg-background p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10">
                <Users className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Clients</p>
                <p className="text-lg font-semibold text-foreground">{activeClientCount}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Announcements are delivered to all active client accounts at the time of sending.
              New clients who register after a broadcast will not see past messages.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
