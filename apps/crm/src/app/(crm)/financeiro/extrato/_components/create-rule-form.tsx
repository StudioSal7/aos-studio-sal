'use client';

import { useRef, useState } from 'react';
import { createCategorizationRuleAction } from '@/server/actions/bank-statement';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export function CreateRuleForm({
  categories,
}: {
  categories: { id: string; name: string; entryKind: 'receita' | 'despesa' }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const feedback = useActionFeedback();

  async function handleSubmit(formData: FormData) {
    feedback.pending();
    const pattern = String(formData.get('pattern') ?? '');
    const categoryId = String(formData.get('categoryId') ?? '');
    const priority = Number(formData.get('priority') ?? 0);

    const result = await createCategorizationRuleAction({ pattern, categoryId, priority });
    if (result.ok) {
      feedback.success('Regra criada.');
      formRef.current?.reset();
      setOpen(false);
    } else {
      feedback.error(result.error);
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        nova regra
      </Button>
    );
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3 border border-line bg-paper p-5">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="rule-pattern">padrão (trecho da descrição)</Label>
          <Input id="rule-pattern" name="pattern" required placeholder="Ex.: netflix" />
        </div>
        <div>
          <Label htmlFor="rule-category">categoria sugerida</Label>
          <Select id="rule-category" name="categoryId" defaultValue={categories[0]?.id}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.entryKind}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="rule-priority">prioridade</Label>
          <Input id="rule-priority" name="priority" type="number" defaultValue={0} />
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
