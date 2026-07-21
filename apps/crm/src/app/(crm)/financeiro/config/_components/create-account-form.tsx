'use client';

import { useRef, useState } from 'react';
import { createFinancialAccountAction } from '@/server/actions/financial';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export function CreateAccountForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const feedback = useActionFeedback();

  async function handleSubmit(formData: FormData) {
    feedback.pending();
    const name = String(formData.get('name') ?? '');
    const kind = String(formData.get('kind') ?? 'banco') as 'banco' | 'caixa' | 'carteira_digital';
    const openingBalanceReais = Number(formData.get('openingBalance') ?? 0);
    const openingBalanceCents = Math.round(openingBalanceReais * 100);

    const result = await createFinancialAccountAction({ name, kind, openingBalanceCents });
    if (result.ok) {
      feedback.success('Conta criada.');
      formRef.current?.reset();
      setOpen(false);
    } else {
      feedback.error(result.error);
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        nova conta
      </Button>
    );
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3 border border-line bg-paper p-5">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="name">nome</Label>
          <Input id="name" name="name" required placeholder="Conta principal" />
        </div>
        <div>
          <Label htmlFor="kind">tipo</Label>
          <Select id="kind" name="kind" defaultValue="banco">
            <option value="banco">banco</option>
            <option value="caixa">caixa</option>
            <option value="carteira_digital">carteira digital</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="openingBalance">saldo inicial (R$)</Label>
          <Input id="openingBalance" name="openingBalance" type="number" step="0.01" defaultValue="0" />
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
