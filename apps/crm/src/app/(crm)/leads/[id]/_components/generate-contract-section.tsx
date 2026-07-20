'use client';

// Ação "gerar contrato" (visível só com o lead em `paid`) + lista dos
// contratos já gerados, com link de download. O .docx é sempre um rascunho —
// nunca enviado automaticamente, sempre baixado manualmente pra revisão.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generateContractAction } from '@/server/actions/contracts';
import type { ContractCollectedData } from '@/server/lib/contract-data-builder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';

export type GenerateContractSectionProps = {
  leadId: string;
  isPaid: boolean;
  contracts: Array<{ id: string; tipo: string; createdAt: Date }>;
};

const TIPO_LABEL: Record<string, string> = {
  mentoria: 'mentoria',
  infoproduto: 'infoproduto',
};

const EMPTY_COLETADO: ContractCollectedData = {
  nomeCompleto: '',
  cpfCnpj: '',
  rg: '',
  endereco: {
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
  },
  condicoesPagamento: '',
};

export function GenerateContractSection({ leadId, isPaid, contracts }: GenerateContractSectionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [coletado, setColetado] = useState<ContractCollectedData>(EMPTY_COLETADO);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openModal() {
    setColetado(EMPTY_COLETADO);
    setError(null);
    setOpen(true);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await generateContractAction({ leadId, coletado });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <section className="border border-line bg-paper p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-micro text-ink-muted">contrato de fechamento</h2>
        {isPaid && (
          <Button variant="solid" size="sm" onClick={openModal}>
            gerar contrato.
          </Button>
        )}
      </div>

      {contracts.length === 0 ? (
        <p className="text-body text-ink-muted">
          {isPaid
            ? 'Nenhum contrato gerado ainda.'
            : 'Disponível depois que o lead fechar (estágio pago).'}
        </p>
      ) : (
        <ul className="space-y-2">
          {contracts.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-4 border-b border-line py-2 text-body text-ink last:border-0"
            >
              <span>
                {TIPO_LABEL[c.tipo] ?? c.tipo} ·{' '}
                <span className="text-micro text-ink-muted normal-case tracking-normal">
                  {new Date(c.createdAt).toLocaleString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </span>
              <a
                href={`/api/leads/${leadId}/contrato/${c.id}`}
                className="text-btn text-ink-muted hover:text-ink hover:underline"
              >
                baixar.
              </a>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} className="max-w-lg">
        <div className="max-h-[80vh] space-y-4 overflow-y-auto">
          <div>
            <h2 className="text-h3 text-ink">gerar contrato.</h2>
            <p className="mt-1 text-micro text-ink-muted normal-case tracking-normal">
              Nome, produto e valor já vêm do lead. Rascunho — revise antes de enviar. Campo
              vazio sai em branco no documento, não trava a geração.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contrato-nome-completo">Nome completo / razão social</Label>
            <Input
              id="contrato-nome-completo"
              autoFocus
              value={coletado.nomeCompleto ?? ''}
              onChange={(e) => setColetado((c) => ({ ...c, nomeCompleto: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="contrato-cpf-cnpj">CPF / CNPJ</Label>
              <Input
                id="contrato-cpf-cnpj"
                value={coletado.cpfCnpj ?? ''}
                onChange={(e) => setColetado((c) => ({ ...c, cpfCnpj: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contrato-rg">RG</Label>
              <Input
                id="contrato-rg"
                value={coletado.rg ?? ''}
                onChange={(e) => setColetado((c) => ({ ...c, rg: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-2">
              <Label htmlFor="contrato-logradouro">Logradouro</Label>
              <Input
                id="contrato-logradouro"
                value={coletado.endereco?.logradouro ?? ''}
                onChange={(e) =>
                  setColetado((c) => ({
                    ...c,
                    endereco: { ...c.endereco, logradouro: e.target.value },
                  }))
                }
              />
            </div>
            <div className="w-24 space-y-2">
              <Label htmlFor="contrato-numero">Número</Label>
              <Input
                id="contrato-numero"
                value={coletado.endereco?.numero ?? ''}
                onChange={(e) =>
                  setColetado((c) => ({ ...c, endereco: { ...c.endereco, numero: e.target.value } }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contrato-complemento">Complemento</Label>
            <Input
              id="contrato-complemento"
              value={coletado.endereco?.complemento ?? ''}
              onChange={(e) =>
                setColetado((c) => ({ ...c, endereco: { ...c.endereco, complemento: e.target.value } }))
              }
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="contrato-bairro">Bairro</Label>
              <Input
                id="contrato-bairro"
                value={coletado.endereco?.bairro ?? ''}
                onChange={(e) =>
                  setColetado((c) => ({ ...c, endereco: { ...c.endereco, bairro: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contrato-cidade">Cidade</Label>
              <Input
                id="contrato-cidade"
                value={coletado.endereco?.cidade ?? ''}
                onChange={(e) =>
                  setColetado((c) => ({ ...c, endereco: { ...c.endereco, cidade: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contrato-estado">Estado</Label>
              <Input
                id="contrato-estado"
                maxLength={2}
                value={coletado.endereco?.estado ?? ''}
                onChange={(e) =>
                  setColetado((c) => ({
                    ...c,
                    endereco: { ...c.endereco, estado: e.target.value.toUpperCase() },
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contrato-cep">CEP</Label>
            <Input
              id="contrato-cep"
              value={coletado.endereco?.cep ?? ''}
              onChange={(e) =>
                setColetado((c) => ({ ...c, endereco: { ...c.endereco, cep: e.target.value } }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contrato-condicoes">Condições de pagamento</Label>
            <Textarea
              id="contrato-condicoes"
              rows={3}
              placeholder="Ex: 3x de R$ 665,67 no cartão, vencimento dia 10"
              value={coletado.condicoesPagamento ?? ''}
              onChange={(e) => setColetado((c) => ({ ...c, condicoesPagamento: e.target.value }))}
            />
          </div>

          {error && <p className="text-sm text-clay">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              cancelar
            </Button>
            <Button variant="solid" size="sm" onClick={submit} disabled={pending}>
              {pending ? 'gerando…' : 'gerar contrato'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
