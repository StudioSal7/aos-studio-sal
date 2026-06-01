'use client';

import { useState, useTransition } from 'react';
import { inviteUserAction } from '@/server/actions/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';

export function InviteUserForm() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'sdr' | 'closer'>('sdr');
  const [isPending, startTransition] = useTransition();
  const feedback = useActionFeedback();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    feedback.pending();
    startTransition(async () => {
      const result = await inviteUserAction(email, role);
      if (result.ok) {
        feedback.success('convite enviado');
        setEmail('');
      } else {
        feedback.error(
          result.error === 'already_registered'
            ? 'este e-mail já está cadastrado'
            : result.error,
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-4 border border-line bg-paper p-6"
    >
      <div className="flex-1 min-w-[240px] space-y-2">
        <Label htmlFor="invite-email">Convidar novo usuário</Label>
        <Input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@exemplo.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-role">Papel</Label>
        <Select
          id="invite-role"
          value={role}
          onChange={(e) => setRole(e.target.value as 'sdr' | 'closer')}
        >
          <option value="sdr">SDR</option>
          <option value="closer">Closer</option>
        </Select>
      </div>
      <Button type="submit" disabled={isPending} variant="solid" size="sm">
        {isPending ? 'enviando...' : 'convidar'}
      </Button>
      <ActionFeedback
        state={feedback.state}
        pendingLabel="enviando..."
        className="w-full"
      />
    </form>
  );
}
