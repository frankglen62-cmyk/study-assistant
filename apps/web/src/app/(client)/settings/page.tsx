import { PageHeading } from '@/components/page-heading';
import { requirePageUser } from '@/lib/auth/page-context';
import { ClientSettingsForm } from '@/features/client/settings-form';
import { getClientSettingsData } from '@/features/client/server';

export default async function SettingsPage() {
  const context = await requirePageUser(['client']);
  const settings = await getClientSettingsData(context.userId);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Preferences"
        title="Settings"
        description="Tune answer style, confidence visibility, detection defaults, and language preferences."
      />
      <ClientSettingsForm initialSettings={settings} />
    </div>
  );
}
