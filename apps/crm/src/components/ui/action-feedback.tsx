'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@repo/ui';

export type ActionFeedbackState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

const SUCCESS_AUTO_DISMISS_MS = 2500;

export function useActionFeedback(initial: ActionFeedbackState = { kind: 'idle' }) {
  const [state, setState] = useState<ActionFeedbackState>(initial);

  useEffect(() => {
    if (state.kind !== 'success') return;
    const t = setTimeout(() => setState({ kind: 'idle' }), SUCCESS_AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [state]);

  const pending = useCallback(() => setState({ kind: 'pending' }), []);
  const success = useCallback(
    (message: string) => setState({ kind: 'success', message }),
    [],
  );
  const error = useCallback(
    (message: string) => setState({ kind: 'error', message }),
    [],
  );
  const reset = useCallback(() => setState({ kind: 'idle' }), []);

  return { state, pending, success, error, reset };
}

export function ActionFeedback({
  state,
  className,
  pendingLabel = 'salvando...',
}: {
  state: ActionFeedbackState;
  className?: string;
  pendingLabel?: string;
}) {
  if (state.kind === 'idle') return null;

  const isSuccess = state.kind === 'success';
  const isError = state.kind === 'error';
  const isPending = state.kind === 'pending';

  return (
    <p
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn(
        'inline-flex items-center gap-1.5 text-micro normal-case tracking-normal',
        isSuccess && 'text-leaf',
        isError && 'text-clay',
        isPending && 'text-ink-muted',
        className,
      )}
    >
      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {isSuccess && <Check className="h-3.5 w-3.5" aria-hidden />}
      {isError && <AlertCircle className="h-3.5 w-3.5" aria-hidden />}
      <span>{isPending ? pendingLabel : state.message}</span>
    </p>
  );
}
