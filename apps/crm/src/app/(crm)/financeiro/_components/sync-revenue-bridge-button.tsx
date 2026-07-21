'use client';

import { syncRevenueBridgeAction } from '@/server/actions/financial-bridge';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';
import { Button } from '@/components/ui/button';

/** Botão que roda a ponte de receita (Hotmart + leads pagos → lançamentos).
 *  Idempotente: rodar de novo não duplica nada — reflete só o que é novo. */
export function SyncRevenueBridgeButton() {
  const feedback = useActionFeedback();

  async function handleClick() {
    feedback.pending();
    const result = await syncRevenueBridgeAction();
    if (!result.ok) {
      feedback.error(result.error);
      return;
    }
    const { hotmartCreated, leadsCreated } = result.data ?? { hotmartCreated: 0, leadsCreated: 0 };
    feedback.success(
      hotmartCreated + leadsCreated === 0
        ? 'Tudo em dia — nenhum lançamento novo.'
        : `${hotmartCreated} venda(s) Hotmart e ${leadsCreated} lead(s) pago(s) lançados.`,
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button size="sm" variant="ghost" onClick={handleClick}>
        sincronizar receita
      </Button>
      <ActionFeedback state={feedback.state} />
    </div>
  );
}
