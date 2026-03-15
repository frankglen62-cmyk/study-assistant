'use client';

import Link from 'next/link';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@study-assistant/ui';

export default function AdminPortalError({
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
          <CardDescription>Admin Portal Error</CardDescription>
          <CardTitle className="text-2xl">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred in the admin portal. If this persists, check the server logs and audit trail for details.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
          )}
          <div className="flex gap-3">
            <Button onClick={reset} variant="secondary">Try Again</Button>
            <Button asChild>
              <Link href="/admin/dashboard">Admin Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
