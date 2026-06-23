import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'better_perplexity',
  description:
    'A trust-weighted, contradiction-aware research assistant: scores source credibility, surfaces agreement vs disagreement, and cites every claim.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
