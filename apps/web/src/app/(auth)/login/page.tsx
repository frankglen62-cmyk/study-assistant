import { Suspense } from 'react';

import { LoginForm } from '@/features/auth/auth-forms';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
