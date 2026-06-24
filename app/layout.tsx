import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Hanken_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

// Typographic signature (issue #27): a humanist sans for prose and UI, a
// monospace reserved for measured, auditable data (trust scores, domains, dates).
const sans = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'better_perplexity: clinical evidence, audited',
  description:
    'A clinical research assistant that scores every source on the evidence hierarchy, surfaces where studies agree and disagree, and cites every claim.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
