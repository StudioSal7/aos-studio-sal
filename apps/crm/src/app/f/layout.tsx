import type { ReactNode } from 'react';

// Minimal public layout for self-hosted forms (no CRM sidebar/chrome).
// The root layout already provides <html>/<body> + Gowun font + globals.
export default function PublicFormLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-canvas text-ink">{children}</div>;
}
