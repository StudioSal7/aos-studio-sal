/**
 * Download do contrato de fechamento (.docx) — primeira rota não-JSON do app.
 *
 * O .docx NUNCA é persistido: é gerado aqui, a cada request, casando o
 * template atual (Supabase Storage, trocável no /admin sem deploy) com o
 * snapshot de dados coletados salvo em `lead_contracts` na hora da geração.
 * Nome/produto/valor vêm sempre atuais do lead (não do snapshot) — se
 * corrigidos depois, o próximo download já reflete a correção.
 *
 * Auth: requireAuth() (mesma sessão Supabase do resto do app — middleware
 * isenta /api/*, então cada rota se autoguarda).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { buildContractData } from '@/server/lib/contract-data-builder';
import { renderContractDocx } from '@/server/lib/contract-docx';
import { downloadContractTemplate } from '@/server/lib/contract-storage';
import { getContractForDownload } from '@/server/queries/contracts';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leadId: string; contractId: string }> },
) {
  await requireAuth();

  const { leadId, contractId } = await params;

  const data = await getContractForDownload(contractId);
  if (!data || data.lead.id !== leadId) {
    return NextResponse.json({ error: 'contrato não encontrado' }, { status: 404 });
  }

  const template = await downloadContractTemplate(data.contract.tipo);
  if (!template) {
    return NextResponse.json(
      {
        error: `Nenhum template de contrato cadastrado para o tipo "${data.contract.tipo}". Envie um em /admin/contratos.`,
      },
      { status: 422 },
    );
  }

  const placeholders = buildContractData({
    lead: data.lead,
    product: data.product,
    coletado: data.contract.dados,
    dataGeracao: new Date(),
  });

  const docxBuffer = renderContractDocx(template, placeholders);

  return new NextResponse(new Uint8Array(docxBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="contrato-${leadId}.docx"`,
    },
  });
}
