'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createProductAction, updateProductAction } from '@/server/actions/products';
import type { ProductRow } from '@/server/queries/products';
import type { ProductTipo } from '@repo/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { centsFromReaisInput, reaisInputFromCents } from '@/lib/money';

type Props =
  | { mode: 'create' }
  | { mode: 'edit'; product: ProductRow };

export function ProductFormModal(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEdit = props.mode === 'edit';
  const initial = isEdit ? props.product : undefined;

  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [tipo, setTipo] = useState<ProductTipo>(initial?.tipo ?? 'mentoria');
  const [valor, setValor] = useState(reaisInputFromCents(initial?.valorCents));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openModal() {
    setDisplayName(initial?.displayName ?? '');
    setTipo(initial?.tipo ?? 'mentoria');
    setValor(reaisInputFromCents(initial?.valorCents));
    setError(null);
    setOpen(true);
  }

  function submit() {
    setError(null);
    const input = { displayName, tipo, valorCents: centsFromReaisInput(valor) };
    startTransition(async () => {
      const res = isEdit
        ? await updateProductAction(props.product.id, input)
        : await createProductAction(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={openModal}
          className="text-btn text-ink-muted hover:text-ink"
        >
          editar.
        </button>
      ) : (
        <Button variant="solid" size="sm" onClick={openModal}>
          <Plus size={16} className="mr-1.5" />
          novo produto
        </Button>
      )}

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <h2 className="text-h3 text-ink">{isEdit ? 'editar produto.' : 'novo produto.'}</h2>

          <div className="space-y-2">
            <Label htmlFor="produto-nome">Nome</Label>
            <Input
              id="produto-nome"
              autoFocus
              value={displayName}
              placeholder="Ex: Mentoria em Grupo"
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="produto-tipo">Tipo</Label>
            <Select
              id="produto-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as ProductTipo)}
            >
              <option value="mentoria">Mentoria</option>
              <option value="assessoria">Assessoria</option>
              <option value="branding_pessoal">Branding pessoal</option>
              <option value="infoproduto">Infoproduto</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="produto-valor">Valor (R$)</Label>
            <Input
              id="produto-valor"
              type="number"
              min="0"
              step="0.01"
              value={valor}
              placeholder="1997.00"
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-clay">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              cancelar
            </Button>
            <Button
              variant="solid"
              size="sm"
              onClick={submit}
              disabled={pending || !displayName.trim()}
            >
              {pending ? 'salvando…' : 'salvar'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
