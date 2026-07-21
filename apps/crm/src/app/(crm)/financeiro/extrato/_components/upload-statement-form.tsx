'use client';

import { useRef } from 'react';
import { importBankStatementAction } from '@/server/actions/bank-statement';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export function UploadStatementForm({ accounts }: { accounts: { id: string; name: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const feedback = useActionFeedback();

  async function handleSubmit(formData: FormData) {
    feedback.pending();
    const result = await importBankStatementAction(formData);
    if (result.ok && result.data) {
      const { parsed, imported, duplicates, parseErrors } = result.data;
      feedback.success(
        `${imported} nova(s) de ${parsed} lida(s)${duplicates > 0 ? ` · ${duplicates} já existiam` : ''}${
          parseErrors > 0 ? ` · ${parseErrors} linha(s) não reconhecida(s)` : ''
        }.`,
      );
      formRef.current?.reset();
    } else if (!result.ok) {
      feedback.error(result.error);
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3 border border-line bg-paper p-5">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="accountId">conta</Label>
          <Select id="accountId" name="accountId" required defaultValue={accounts[0]?.id}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="format">formato</Label>
          <Select id="format" name="format" defaultValue="ofx">
            <option value="ofx">OFX</option>
            <option value="csv">CSV</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="file">arquivo</Label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".ofx,.csv,.txt"
            required
            className="block w-full border border-line bg-paper px-4 py-3 text-body text-ink file:mr-3 file:border-0 file:bg-canvas file:px-3 file:py-1.5 file:text-btn"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="solid" size="sm">
          importar
        </Button>
        <ActionFeedback state={feedback.state} />
      </div>
    </form>
  );
}
