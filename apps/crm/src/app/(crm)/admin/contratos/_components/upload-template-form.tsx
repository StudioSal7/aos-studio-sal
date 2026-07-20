'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductTipo } from '@repo/db/schema';
import { uploadContractTemplateAction } from '@/server/actions/contracts';
import { Button } from '@/components/ui/button';

export function UploadTemplateForm({ tipo }: { tipo: ProductTipo }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(file: File) {
    setError(null);
    const formData = new FormData();
    formData.set('tipo', tipo);
    formData.set('file', file);
    startTransition(async () => {
      const res = await uploadContractTemplateAction(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (inputRef.current) inputRef.current.value = '';
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".docx"
          disabled={pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) submit(file);
          }}
          className="hidden"
          id={`upload-template-${tipo}`}
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? 'enviando…' : 'trocar template.'}
        </Button>
      </div>
      {error && <p className="text-sm text-clay">{error}</p>}
    </div>
  );
}
