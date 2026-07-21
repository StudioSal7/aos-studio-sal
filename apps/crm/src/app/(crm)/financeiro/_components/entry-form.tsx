'use client';

import { useRef, useState } from 'react';
import {
  createFinancialEntryAction,
  updateFinancialEntryAction,
} from '@/server/actions/financial-entries';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type CategoryOption = { id: string; name: string; entryKind: 'receita' | 'despesa' };
type AccountOption = { id: string; name: string };

type ExistingEntry = {
  id: string;
  description: string;
  amountCents: number;
  competenceDate: string;
  dueDate: string | null;
  categoryId: string;
  notes: string | null;
};

/** Form de lançamento — mesma UI serve pra criar (kind livre) e editar
 *  (kind fixo, descrição/valor/datas/categoria editáveis; origem manual só). */
export function EntryForm({
  categories,
  existing,
  onDone,
}: {
  categories: CategoryOption[];
  existing?: ExistingEntry & { kind: 'receita' | 'despesa' };
  onDone?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const feedback = useActionFeedback();
  const [kind, setKind] = useState<'receita' | 'despesa'>(existing?.kind ?? 'despesa');

  const categoriesForKind = categories.filter((c) => c.entryKind === kind);

  async function handleSubmit(formData: FormData) {
    feedback.pending();
    const description = String(formData.get('description') ?? '');
    const amountReais = Number(formData.get('amount') ?? 0);
    const amountCents = Math.round(amountReais * 100);
    const competenceDate = String(formData.get('competenceDate') ?? '');
    const dueDateRaw = String(formData.get('dueDate') ?? '');
    const dueDate = dueDateRaw ? dueDateRaw : null;
    const categoryId = String(formData.get('categoryId') ?? '');
    const notesRaw = String(formData.get('notes') ?? '');
    const notes = notesRaw ? notesRaw : null;

    const result = existing
      ? await updateFinancialEntryAction(existing.id, {
          description,
          amountCents,
          competenceDate,
          dueDate,
          categoryId,
          notes,
        })
      : await createFinancialEntryAction({
          kind,
          description,
          amountCents,
          competenceDate,
          dueDate,
          categoryId,
          accountId: null,
          notes,
        });

    if (result.ok) {
      feedback.success(existing ? 'Lançamento atualizado.' : 'Lançamento criado.');
      formRef.current?.reset();
      onDone?.();
    } else {
      feedback.error(result.error);
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3 border border-line bg-paper p-5">
      <div className="grid grid-cols-2 gap-3">
        {!existing && (
          <div>
            <Label htmlFor="kind">natureza</Label>
            <Select
              id="kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as 'receita' | 'despesa')}
            >
              <option value="despesa">despesa</option>
              <option value="receita">receita</option>
            </Select>
          </div>
        )}
        <div className={existing ? 'col-span-2' : ''}>
          <Label htmlFor="description">descrição</Label>
          <Input
            id="description"
            name="description"
            required
            defaultValue={existing?.description}
            placeholder="Ex.: Ferramenta X — assinatura mensal"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="amount">valor (R$)</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={existing ? (existing.amountCents / 100).toFixed(2) : undefined}
          />
        </div>
        <div>
          <Label htmlFor="competenceDate">competência</Label>
          <Input
            id="competenceDate"
            name="competenceDate"
            type="date"
            required
            defaultValue={existing?.competenceDate}
          />
        </div>
        <div>
          <Label htmlFor="dueDate">vencimento (opcional)</Label>
          <Input id="dueDate" name="dueDate" type="date" defaultValue={existing?.dueDate ?? undefined} />
        </div>
      </div>

      <div>
        <Label htmlFor="categoryId">categoria</Label>
        <Select id="categoryId" name="categoryId" defaultValue={existing?.categoryId ?? categoriesForKind[0]?.id}>
          {categoriesForKind.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="notes">notas (opcional)</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={existing?.notes ?? undefined} />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="solid" size="sm">
          {existing ? 'salvar alterações' : 'lançar'}
        </Button>
        {onDone && (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            cancelar
          </Button>
        )}
        <ActionFeedback state={feedback.state} />
      </div>
    </form>
  );
}
