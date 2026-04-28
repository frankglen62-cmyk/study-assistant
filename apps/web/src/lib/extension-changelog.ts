export interface ExtensionChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
}

export const extensionChangelog: ExtensionChangelogEntry[] = [
  {
    version: '0.1.98',
    date: '2026-04-25',
    highlights: [
      'Hardened pairing flow with shorter-lived codes and signed device tokens.',
      'Tightened CSP / CORS handling so the side panel only reaches your portal.',
      'Smaller bundle size and a faster cold-start for the side panel.',
    ],
  },
  {
    version: '0.1.97',
    date: '2026-04-15',
    highlights: [
      'Restored compatibility with the latest Chrome release after a manifest API change.',
      'Improved error toasts when the portal is offline or rate-limited.',
    ],
  },
];

export function getChangelogEntry(version: string): ExtensionChangelogEntry | undefined {
  return extensionChangelog.find((entry) => entry.version === version);
}
