'use client';

import { Button } from '@study-assistant/ui';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-foreground">
        <div className="max-w-md space-y-6 text-center">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">Something went wrong</h1>
          <p className="text-muted-foreground">
            An unexpected error occurred. Your data is safe — please try again or return to the home page.
          </p>
          {error.digest && (
            <p className="text-xs text-neutral-600">Reference: {error.digest}</p>
          )}
          <div className="flex justify-center gap-3">
            <Button onClick={reset} variant="secondary">Try Again</Button>
            <Button onClick={() => (window.location.href = '/')}>Return Home</Button>
          </div>
        </div>
      </body>
    </html>
  );
}
