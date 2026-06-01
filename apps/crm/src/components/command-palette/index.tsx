'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  KanbanSquare,
  Flame,
  AlertTriangle,
  Calendar,
  BarChart3,
  Activity,
  Search,
  Settings,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@repo/ui';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { searchLeadsForPalette, type PaletteLeadResult } from '@/server/actions/search';

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: typeof KanbanSquare;
  shortcut?: string;
  ownerOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'kanban', label: 'pipeline', href: '/kanban', icon: KanbanSquare, shortcut: 'g k' },
  { id: 'busca', label: 'busca', href: '/busca', icon: Search, shortcut: 'g b' },
  { id: 'quentes', label: 'quentes', href: '/quentes', icon: Flame, shortcut: 'g q' },
  { id: 'revisao', label: 'para revisão', href: '/revisao', icon: AlertTriangle, shortcut: 'g r' },
  { id: 'calendario', label: 'calendário', href: '/calendario', icon: Calendar, shortcut: 'g c' },
  { id: 'dashboard', label: 'dashboard', href: '/dashboard', icon: BarChart3, shortcut: 'g d' },
  { id: 'saude', label: 'saúde dos dados', href: '/saude', icon: Activity, shortcut: 'g s' },
  { id: 'admin', label: 'admin', href: '/admin', icon: Settings, shortcut: 'g a', ownerOnly: true },
];

const SHORTCUT_MAP: Record<string, string> = NAV_ITEMS.reduce((acc, item) => {
  const parts = item.shortcut?.split(' ');
  const key = parts?.[1];
  if (key) acc[key] = item.href;
  return acc;
}, {} as Record<string, string>);

export function CommandPalette({ isOwner }: { isOwner: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [leads, setLeads] = useState<PaletteLeadResult[]>([]);
  const [, startTransition] = useTransition();

  // Global Cmd+K listener + `g <letter>` shortcuts
  useEffect(() => {
    let goLeader = false;
    let goLeaderTimer: ReturnType<typeof setTimeout> | null = null;

    function clearLeader() {
      goLeader = false;
      if (goLeaderTimer) {
        clearTimeout(goLeaderTimer);
        goLeaderTimer = null;
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }

      // Don't trigger leader shortcuts while typing in inputs or when palette is open
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isTyping || open || e.metaKey || e.ctrlKey || e.altKey) {
        clearLeader();
        return;
      }

      if (goLeader) {
        const target = SHORTCUT_MAP[e.key.toLowerCase()];
        clearLeader();
        if (target) {
          e.preventDefault();
          router.push(target as Route);
        }
        return;
      }

      if (e.key.toLowerCase() === 'g') {
        goLeader = true;
        goLeaderTimer = setTimeout(clearLeader, 1200);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (goLeaderTimer) clearTimeout(goLeaderTimer);
    };
  }, [open, router]);

  // Debounced lead search
  useEffect(() => {
    if (!open) {
      setQuery('');
      setLeads([]);
      return;
    }
    if (!query.trim()) {
      setLeads([]);
      return;
    }
    const handle = setTimeout(() => {
      startTransition(async () => {
        const results = await searchLeadsForPalette(query);
        setLeads(results);
      });
    }, 150);
    return () => clearTimeout(handle);
  }, [open, query]);

  const handleNavigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href as Route<string>);
    },
    [router],
  );

  const visibleNavItems = NAV_ITEMS.filter((i) => !i.ownerOnly || isOwner);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-ink/20',
            'data-[state=closed]:opacity-0 data-[state=open]:opacity-100',
            'transition-opacity duration-150',
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-[20vh] z-50 w-full max-w-xl -translate-x-1/2 border border-line bg-paper shadow-xl outline-none',
            'data-[state=closed]:opacity-0 data-[state=open]:opacity-100',
            'transition-opacity duration-150',
          )}
          aria-label="Paleta de comandos"
        >
          <DialogPrimitive.Title className="sr-only">
            Paleta de comandos
          </DialogPrimitive.Title>
          <Command shouldFilter={false} loop>
            <CommandInput
              placeholder="buscar lead ou navegar..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>nenhum resultado.</CommandEmpty>

              {leads.length > 0 && (
                <CommandGroup heading="LEADS">
                  {leads.map((lead) => (
                    <CommandItem
                      key={lead.id}
                      value={`lead-${lead.id}`}
                      onSelect={() => handleNavigate(`/leads/${lead.id}`)}
                    >
                      <UserIcon className="h-4 w-4 text-ink-muted" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate">
                          {lead.nickname ?? lead.name ?? 'sem nome'}
                        </span>
                        {lead.email && (
                          <span className="block truncate text-micro text-ink-muted normal-case tracking-normal">
                            {lead.email}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {(!query.trim() || leads.length === 0) && (
                <CommandGroup heading="NAVEGAR">
                  {visibleNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={item.id}
                        value={`nav-${item.id}`}
                        onSelect={() => handleNavigate(item.href)}
                      >
                        <Icon className="h-4 w-4 text-ink-muted" aria-hidden />
                        <span>{item.label}</span>
                        {item.shortcut && (
                          <CommandShortcut>{item.shortcut}</CommandShortcut>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
