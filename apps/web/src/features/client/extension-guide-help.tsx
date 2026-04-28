import Link from 'next/link';
import { ChevronRight, HelpCircle, ShieldCheck } from 'lucide-react';

import { Button } from '@study-assistant/ui';

import { extensionManifestFileName } from '@/lib/extension-distribution';

const helpItems = [
  {
    question: 'Chrome says "Manifest file is missing or unreadable"',
    answer: `You probably picked the ZIP file or a parent folder. Extract the ZIP first, then in chrome://extensions click Load unpacked and choose the folder where ${extensionManifestFileName} is directly visible.`,
  },
  {
    question: 'My pairing code expired before I could paste it',
    answer:
      'Codes are intentionally short-lived. Click Regenerate in the Pairing Mode card above to get a fresh one — it copies to your clipboard automatically.',
  },
  {
    question: "I don't see the extension icon in my toolbar",
    answer:
      'Open chrome://extensions, find Study Assistant, and toggle Pin (the puzzle-piece icon → pin). The icon should appear next to the address bar.',
  },
  {
    question: 'The side panel shows "Not paired" even after I generated a code',
    answer:
      'Open the extension, paste the App URL, the Device Name, and the pairing code in that order. Make sure the App URL has no trailing space. If it still fails, regenerate the code and try again within 5 minutes.',
  },
  {
    question: 'I updated my browser and the extension disappeared',
    answer:
      'Unpacked extensions can be removed by some Chrome updates. Re-download the latest ZIP from the top of this page, then repeat steps 2–3 to load and pair it again. Your account credits are unaffected.',
  },
] as const;

export function ExtensionGuideHelp() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/40 bg-background shadow-card">
      <div className="flex flex-col gap-2 border-b border-border/40 px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            Common problems & quick fixes
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Most install / pairing issues fall into one of these. Click any item to expand the fix.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/contact">
            <ShieldCheck className="h-4 w-4" />
            Still stuck — contact support
          </Link>
        </Button>
      </div>
      <ul className="divide-y divide-border/30">
        {helpItems.map((item) => (
          <li key={item.question}>
            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 text-sm font-medium text-foreground">
                <span>{item.question}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <div className="px-6 pb-5 text-sm text-muted-foreground">{item.answer}</div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
