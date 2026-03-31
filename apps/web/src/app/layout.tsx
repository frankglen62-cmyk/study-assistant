import type { Metadata } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import '@/app/globals.css';
import { ToastViewport } from '@/components/feedback/toast-viewport';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ToastProvider } from '@/components/providers/toast-provider';

const bodyFont = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const displayFont = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Admin-Managed AI Study Assistant',
  description:
    'Private-source study assistance with subject-aware retrieval, admin-managed content, and a secure Chrome extension workflow.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ToastProvider>
            {children}
            <ToastViewport />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
