import Link from 'next/link';

import { Button } from '@study-assistant/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md space-y-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.18em] text-accent">404</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Page not found</h1>
        </div>
        <p className="text-muted-foreground">
          The page you are looking for does not exist or has been moved. Check the URL or navigate back to a known section.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild variant="secondary">
            <Link href="/">Home</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
