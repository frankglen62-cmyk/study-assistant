import type { Metadata } from 'next';
import { Inter, DM_Serif_Display } from 'next/font/google';
import type { ReactNode } from 'react';

import '@/app/globals.css';
import { ToastViewport } from '@/components/feedback/toast-viewport';
import { ToastProvider } from '@/components/providers/toast-provider';

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const displayFont = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Study Assistant — AI-Powered Subject Review',
  description:
    'Private-source study assistance with subject-aware retrieval, admin-managed content, and a secure Chrome extension workflow.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <ToastProvider>
          {children}
          <ToastViewport />
        </ToastProvider>
      </body>
    </html>
  );
}
