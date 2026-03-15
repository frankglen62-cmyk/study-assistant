'use client';

import { useEffect, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCcw } from 'lucide-react';

import { Button } from '@study-assistant/ui';

export function AdminLiveRefresh({ label = 'Live refresh every 15s' }: { label?: string }) {
  const router = useRouter();
  const [secondsRemaining, setSecondsRemaining] = useState(15);

  useEffect(() => {
    const countdown = window.setInterval(() => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          startTransition(() => {
            router.refresh();
          });
          return 15;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(countdown);
  }, [router]);

  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-muted-foreground">{`${label} · next refresh in ${secondsRemaining}s`}</p>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setSecondsRemaining(15);
          startTransition(() => {
            router.refresh();
          });
        }}
      >
        <RefreshCcw className="mr-2 h-4 w-4" />
        Refresh Now
      </Button>
    </div>
  );
}
