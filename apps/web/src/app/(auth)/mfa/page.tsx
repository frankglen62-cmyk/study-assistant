import { Suspense } from 'react';

import { MfaChallengeForm } from '@/features/auth/mfa';

export default function MfaPage() {
  return (
    <Suspense>
      <MfaChallengeForm />
    </Suspense>
  );
}
