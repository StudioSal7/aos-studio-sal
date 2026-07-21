'use client';

import { useRef, useState } from 'react';
import { createFinancialRecurringTemplateAction } from '@/server/actions/financial-recurring';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

type CategoryOption = { id: string; name: string; entryKind: 'receita' | 'despesa' };
type AccountOption = { id: string; name: string };

export function CreateRecurringForm({
  categories,
  accounts,
}: {
  categories: CategoryOption[];
  accounts: AccountOption[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'receita' | 'despesa'>('despesa');
  const feedback = useActionFeedback();

  const categoriesForKind = categories.filter((c) => c.entryKind === kind);

  async function handleSubmit(formData: FormData) {
    feedback.pending();
    const description = String(formData.get('description') ?? '');
    const amountReais = Number(formData.get('amount') ?? 0);
    const amountCents = Math.round(amountReais * 100);
    const categoryId = String(formData.get('categoryId') ?? '');
    const accountIdRaw = String(formData.get('accountId') ?? '');
    const accountId = accountIdRaw || null;
    const dayOfMonth = Number(formData.get('dayOfMonth') ?? 1);
    const startDate = String(formData.get('startDate') ?? '');
    const endDateRaw = String(formData.get('endDate') ?? '');
    const endDate = endDateRaw || null;

    const result = await createFinancialRecurringTemplateAction({
      kind,
      description,
      amountCents,
      categoryId,
      accountId,
      dayOfMonth,
      startDate,
      endDate,
    });

    if (result.ok) {
      feedback.success('Recorrência criada.');
      formRef.current?.reset();
      setOpen(false);
    } else {
      feedback.error(result.error);
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        nova recorrência
      </Button>
    );
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3 border border-line bg-paper p-5">
      <div className="grid grid-cols-2 gap-3">
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
        <div>
          <Label htmlFor="description">descrição</Label>
          <Input id="description" name="description" required placeholder="Ex.: Aluguel do escritório" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="amount">valor (R$)</Label>
          <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
        </div>
        <div>
          <Label htmlFor="dayOfMonth">dia do vencimento</Label>
          <Input id="dayOfMonth" name="dayOfMonth" type="number" min="1" max="31" required defaultValue="5" />
        </div>
        <div>
          <Label htmlFor="categoryId">categoria</Label>
          <Select id="categoryId" name="categoryId" defaultValue={categoriesForKind[0]?.id}>
            {categoriesForKind.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="accountId">conta (opcional)</Label>
          <Select id="accountId" name="accountId" defaultValue="">
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="startDate">início</Label>
          <Input id="startDate" name="startDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div>
          <Label htmlFor="endDate">fim (opcional)</Label>
          <Input id="endDate" name="endDate" type="date" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="solid" size="sm">
          salvar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          cancelar
        </Button>
        <ActionFeedback state={feedback.state} />
      </div>
    </form>
  );
}
