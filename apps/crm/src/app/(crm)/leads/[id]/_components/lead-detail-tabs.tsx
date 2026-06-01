'use client';

import { useState, type ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type TabId = 'atividade' | 'info' | 'comercial' | 'historico';

export function LeadDetailTabs({
  atividade,
  info,
  comercial,
  historico,
  defaultTab = 'atividade',
}: {
  atividade: ReactNode;
  info: ReactNode;
  comercial: ReactNode;
  historico: ReactNode;
  defaultTab?: TabId;
}) {
  const [tab, setTab] = useState<TabId>(defaultTab);

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
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
