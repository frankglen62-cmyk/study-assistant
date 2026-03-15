'use client';

import Link from 'next/link';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <Card className="max-w-lg">
        <CardHeader>
          <CardDescription>Something went wrong</CardDescription>
          <CardTitle className="text-2xl">We could not load this page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred while loading this page. Please try again or return to the home page.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
          )}
          <div className="flex gap-3">
            <Button onClick={reset} variant="secondary">Try Again</Button>
            <Button asChild>
              <Link href="/">Return Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
