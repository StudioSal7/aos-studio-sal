'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type TabId = 'atividade' | 'info' | 'comercial' | 'historico';

const TAB_IDS: TabId[] = ['atividade', 'info', 'comercial', 'historico'];

export function LeadDetailTabs({
  leadId,
  atividade,
  info,
  comercial,
  historico,
  defaultTab = 'atividade',
}: {
  leadId: string;
  atividade: ReactNode;
  info: ReactNode;
  comercial: ReactNode;
  historico: ReactNode;
  defaultTab?: TabId;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const param = searchParams.get('tab');
  const tab: TabId = TAB_IDS.includes(param as TabId) ? (param as TabId) : defaultTab;

  // Deep-link da timeline: ao cair na aba do dossiê com hash #resp-<id>, rola até
  // a resposta. Best-effort — o conteúdo da aba só monta quando ela fica ativa.
  useEffect(() => {
    if (tab !== 'info') return;
    const hash = window.location.hash;
    if (!hash.startsWith('#resp-')) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (el instanceof HTMLDetailsElement) el.open = true;
    }
  }, [tab]);

  return (
    <Tabs
      value={tab}
      onValueChange={(v) =>
        router.replace(`/leads/${leadId}?tab=${v}`, { scroll: false })
      }
    >
      <TabsList className="px-8">
        <TabsTrigger value="atividade">atividade</TabsTrigger>
        <TabsTrigger value="info">informações</TabsTrigger>
        <TabsTrigger value="comercial">comercial</TabsTrigger>
        <TabsTrigger value="historico">histórico</TabsTrigger>
      </TabsList>

      <div className="px-8 py-6">
        <TabsContent value="atividade">{atividade}</TabsContent>
        <TabsContent value="info">{info}</TabsContent>
        <TabsContent value="comercial">{comercial}</TabsContent>
        <TabsContent value="historico">{historico}</TabsContent>
      </div>
    </Tabs>
  );
}
