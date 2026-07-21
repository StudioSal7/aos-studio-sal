'use client';

import { useRef, useState } from 'react';
import { createFinancialCategoryAction } from '@/server/actions/financial';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

const DRE_SECTION_LABEL: Record<string, string> = {
  receita_bruta: 'receita bruta',
  deducao: 'dedução',
  imposto: 'imposto',
  custo: 'custo',
  despesa_fixa: 'despesa fixa',
  despesa_variavel: 'despesa variável',
  outra: 'outra',
};

export function CreateCategoryForm({
  groups,
}: {
  groups: { id: string; name: string; dreSection: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const feedback = useActionFeedback();

  async function handleSubmit(formData: FormData) {
    feedback.pending();
    const name = String(formData.get('name') ?? '');
    const parentId = String(formData.get('parentId') ?? '');
    const parent = groups.find((g) => g.id === parentId);
    if (!parent) {
      feedback.error('Selecione um grupo.');
      return;
    }
    const entryKind = String(formData.get('entryKind') ?? 'despesa') as 'receita' | 'despesa';

    const result = await createFinancialCategoryAction({
      name,
      entryKind,
      dreSection: parent.dreSection as never,
      parentId: parent.id,
    });
    if (result.ok) {
      feedback.success('Categoria criada.');
      formRef.current?.reset();
      setOpen(false);
    } else {
      feedback.error(result.error);
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        nova categoria
      </Button>
    );
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3 border border-line bg-paper p-5">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="cat-name">nome</Label>
          <Input id="cat-name" name="name" required placeholder="Ex.: Copywriter freelancer" />
        </div>
        <div>
          <Label htmlFor="cat-kind">natureza</Label>
          <Select id="cat-kind" name="entryKind" defaultValue="despesa">
            <option value="receita">receita</option>
            <option value="despesa">despesa</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="cat-parent">grupo (seção do DRE)</Label>
          <Select id="cat-parent" name="parentId" defaultValue={groups[0]?.id}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} · {DRE_SECTION_LABEL[g.dreSection] ?? g.dreSection}
              </option>
            ))}
          </Select>
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
