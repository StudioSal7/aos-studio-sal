import type { Route } from 'next';
import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutGrid,
  Flame,
  Eye,
  Calendar,
  LineChart,
  Activity,
  Shield,
  ShoppingBag,
  Target,
  ClipboardCheck,
  MessageSquareText,
  ListTodo,
  Dumbbell,
  FileText,
  Settings,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { requireAuth } from '@/server/auth';
import { logoutAction } from '@/app/login/actions';
import { CommandPalette } from '@/components/command-palette';
import { CollapsibleNavGroup } from './_components/collapsible-nav-group';

export default async function CrmLayout({ children }: { children: ReactNode }) {
  const auth = await requireAuth();
  const isOwner = auth.role === 'owner';

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-paper">
        <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
          <Image
            src="/logo.png"
            alt="Studio SAL"
            width={120}
            height={40}
            className="object-contain"
            priority
          />
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          <NavItem href="/dashboard" label="dashboard." icon={LineChart} />

          <CollapsibleNavGroup label="crm">
            <NavItem href="/kanban" label="kanban." icon={LayoutGrid} />
            <NavItem href="/quentes" label="quentes." icon={Flame} />
            <NavItem href="/revisao" label="para revisão." icon={Eye} />
            <NavItem href="/calendario" label="calendário." icon={Calendar} />
            <NavItem href="/saude" label="saúde dos dados." icon={Activity} />
            {isOwner && (
              <NavItem
                href={'/admin/formularios' as Route<string>}
                label="formulários."
                icon={FileText}
              />
            )}
            <NavItem href="/tarefas" label="tarefas." icon={ListTodo} />
          </CollapsibleNavGroup>

          <CollapsibleNavGroup label="comercial">
            <NavItem href={"/analise/closer" as Route<string>} label="análise closer." icon={ClipboardCheck} />
            <NavItem href={"/analise/sdr" as Route<string>} label="análise sdr." icon={MessageSquareText} />
            <NavItem href={"/comercial/treino" as Route<string>} label="treino spin." icon={Dumbbell} />
            {isOwner && <NavItem href="/vendas-sal" label="vendas sal." icon={ShoppingBag} />}
          </CollapsibleNavGroup>

          <CollapsibleNavGroup label="marketing">
            <NavItem href="/trafego" label="tráfego pago." icon={Target} />
          </CollapsibleNavGroup>

          {isOwner && (
            <CollapsibleNavGroup label="financeiro">
              <NavItem href={'/financeiro' as Route<string>} label="lançamentos." icon={Wallet} />
              <NavItem href={'/financeiro/dre' as Route<string>} label="dre." icon={LineChart} />
              <NavItem
                href={'/financeiro/config' as Route<string>}
                label="configuração."
                icon={Settings}
              />
            </CollapsibleNavGroup>
          )}
        </nav>

        <div className="shrink-0 space-y-3 border-t border-line p-4">
          {isOwner && <NavItem href="/admin" label="admin." icon={Shield} />}
          <p className="truncate text-micro text-ink-muted normal-case tracking-normal">
            {auth.email}
          </p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-btn text-ink-muted hover:text-ink"
            >
              sair.
            </button>
          </form>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        {children}
      </main>

      <CommandPalette isOwner={isOwner} />
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
}: {
  href: ComponentProps<typeof Link>['href'];
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-3 text-btn text-ink-muted hover:bg-canvas hover:text-ink"
    >
      <Icon size={20} strokeWidth={1.5} />
      <span>{label}</span>
    </Link>
  );
}
