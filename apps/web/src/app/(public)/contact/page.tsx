import { ContactPageClient } from '@/features/public/contact-page-client';
import { getSystemSettings } from '@/lib/platform/system-settings';

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const settings = await getSystemSettings();

  return <ContactPageClient supportEmail={settings.supportEmail} />;
}
