import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Gowun_Batang } from 'next/font/google';
import './globals.css';

const gowun = Gowun_Batang({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-gowun',
});

export const metadata: Metadata = {
  title: 'a revolução.',
  description: 'CRM Fase 1',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={gowun.variable}>
      <body className="bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
