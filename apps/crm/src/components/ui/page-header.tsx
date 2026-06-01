import type { ReactNode } from 'react';

export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-paper px-8">
      <h1 className="text-h2 text-ink">{title}</h1>
      {children}
    </header>
  );
}
