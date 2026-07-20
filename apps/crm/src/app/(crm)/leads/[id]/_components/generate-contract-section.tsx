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
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { productTipoLabel } from '@/lib/product-tipo';

export type GenerateContractSectionProps = {
  leadId: string;
  isPaid: boolean;
  contracts: Array<{ id: string; tipo: string; createdAt: Date }>;
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
  pagamento: { tipo: 'a_vista', metodo: 'pix' },
};

const METODOS = [
  ['pix', 'PIX'],
  ['cartao_credito', 'Cartão de crédito'],
  ['boleto', 'Boleto'],
  ['transferencia', 'Transferência bancária'],
  ['outro', 'Outro'],
] as const;

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

  // 14 dígitos = CNPJ = pessoa jurídica (mesma detecção do builder, inline pra
  // não puxar o módulo server pro bundle do client).
  const isPJ = (coletado.cpfCnpj ?? '').replace(/[^0-9]/g, '').length === 14;

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
                {productTipoLabel(c.tipo)} ·{' '}
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

          <div className="space-y-2">
            <Label htmlFor="contrato-cpf-cnpj">
              CPF / CNPJ{' '}
              <span className="text-ink-muted">{isPJ ? '· pessoa jurídica' : '· pessoa física'}</span>
            </Label>
            <Input
              id="contrato-cpf-cnpj"
              value={coletado.cpfCnpj ?? ''}
              onChange={(e) => setColetado((c) => ({ ...c, cpfCnpj: e.target.value }))}
            />
          </div>

          {isPJ ? (
            <div className="space-y-3 border border-line bg-canvas p-3">
              <p className="text-micro text-ink-muted">representante legal (pessoa jurídica)</p>
              <div className="space-y-2">
                <Label htmlFor="contrato-rep-nome">Nome do representante</Label>
                <Input
                  id="contrato-rep-nome"
                  value={coletado.representanteNome ?? ''}
                  onChange={(e) => setColetado((c) => ({ ...c, representanteNome: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="contrato-rep-cpf">CPF do representante</Label>
                  <Input
                    id="contrato-rep-cpf"
                    value={coletado.representanteCpf ?? ''}
                    onChange={(e) => setColetado((c) => ({ ...c, representanteCpf: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contrato-rep-rg">RG do representante</Label>
                  <Input
                    id="contrato-rep-rg"
                    value={coletado.representanteRg ?? ''}
                    onChange={(e) => setColetado((c) => ({ ...c, representanteRg: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="contrato-rg">RG</Label>
                <Input
                  id="contrato-rg"
                  value={coletado.rg ?? ''}
                  onChange={(e) => setColetado((c) => ({ ...c, rg: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contrato-nacionalidade">Nacionalidade</Label>
                <Input
                  id="contrato-nacionalidade"
                  placeholder="brasileira"
                  value={coletado.nacionalidade ?? ''}
                  onChange={(e) => setColetado((c) => ({ ...c, nacionalidade: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contrato-profissao">Profissão</Label>
                <Input
                  id="contrato-profissao"
                  value={coletado.profissao ?? ''}
                  onChange={(e) => setColetado((c) => ({ ...c, profissao: e.target.value }))}
                />
              </div>
            </div>
          )}

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

          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-micro text-ink-muted">
              pagamento · o valor total vem do fechamento do lead; a parcela é calculada a partir dele
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="contrato-pag-tipo">Forma</Label>
                <Select
                  id="contrato-pag-tipo"
                  value={coletado.pagamento?.tipo ?? 'a_vista'}
                  onChange={(e) => {
                    const tipo = e.target.value as 'a_vista' | 'parcelado';
                    setColetado((c) => ({
                      ...c,
                      pagamento:
                        tipo === 'parcelado'
                          ? { tipo, metodo: c.pagamento?.metodo ?? 'cartao_credito', numParcelas: 2, vencimento: '' }
                          : { tipo, metodo: c.pagamento?.metodo ?? 'pix' },
                    }));
                  }}
                >
                  <option value="a_vista">À vista</option>
                  <option value="parcelado">Parcelado</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contrato-pag-metodo">Método</Label>
                <Select
                  id="contrato-pag-metodo"
                  value={coletado.pagamento?.metodo ?? 'pix'}
                  onChange={(e) =>
                    setColetado((c) => ({
                      ...c,
                      pagamento: { ...(c.pagamento ?? { tipo: 'a_vista' }), metodo: e.target.value },
                    }))
                  }
                >
                  {METODOS.map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {coletado.pagamento?.tipo === 'parcelado' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="contrato-pag-parcelas">Nº de parcelas</Label>
                  <Input
                    id="contrato-pag-parcelas"
                    type="number"
                    min="2"
                    step="1"
                    value={coletado.pagamento.numParcelas || ''}
                    onChange={(e) =>
                      setColetado((c) => ({
                        ...c,
                        pagamento: {
                          tipo: 'parcelado',
                          metodo: c.pagamento?.metodo ?? 'cartao_credito',
                          numParcelas: Math.max(2, Number(e.target.value) || 2),
                          vencimento: c.pagamento && 'vencimento' in c.pagamento ? c.pagamento.vencimento : '',
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contrato-pag-venc">Vencimento</Label>
                  <Input
                    id="contrato-pag-venc"
                    placeholder="Ex: todo dia 10"
                    value={(coletado.pagamento.vencimento as string) ?? ''}
                    onChange={(e) =>
                      setColetado((c) => ({
                        ...c,
                        pagamento: {
                          tipo: 'parcelado',
                          metodo: c.pagamento?.metodo ?? 'cartao_credito',
                          numParcelas:
                            c.pagamento && 'numParcelas' in c.pagamento ? c.pagamento.numParcelas : 2,
                          vencimento: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            )}
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
