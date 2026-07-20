'use client';

import { useState, useTransition } from 'react';
import {
  deleteMetricTargetAction,
  upsertMetricTargetAction,
} from '@/server/actions/metric-targets';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ActionFeedback, useActionFeedback } from '@/components/ui/action-feedback';

// Uma linha da tabela "metas do dashboard" — edição pontual com salvar por
// linha (9 métricas no máximo, sem save geral). Props primitivas: o Map do
// server vira `target` plano por linha na page.
export function MetricTargetRowForm({
  metric,
  target,
}: {
  metric: { key: string; label: string; unit: 'pct' | 'hours'; defaultComparator: 'gte' | 'lte' };
  target: { comparator: 'gte' | 'lte'; threshold: number; yellowMargin: number } | null;
}) {
  const [comparator, setComparator] = useState<'gte' | 'lte'>(
    target?.comparator ?? metric.defaultComparator,
  );
  const [threshold, setThreshold] = useState(target !== null ? String(target.threshold) : '');
  const [yellowMargin, setYellowMargin] = useState(
    target !== null ? String(target.yellowMargin) : '0',
  );
  const [isPending, startTransition] = useTransition();
  const feedback = useActionFeedback();

  const unitSuffix = metric.unit === 'pct' ? '%' : 'h';

  function handleSave() {
    feedback.pending();
    startTransition(async () => {
      const result = await upsertMetricTargetAction({
        metricKey: metric.key,
        comparator,
        threshold: Number(threshold),
        yellowMargin: Number(yellowMargin === '' ? '0' : yellowMargin),
      });
      if (result.ok) feedback.success('meta salva');
      else feedback.error(result.error);
    });
  }

  function handleRemove() {
    feedback.pending();
    startTransition(async () => {
      const result = await deleteMetricTargetAction(metric.key);
      if (result.ok) {
        feedback.success('meta removida');
        setThreshold('');
        setYellowMargin('0');
        setComparator(metric.defaultComparator);
      } else {
        feedback.error(result.error);
      }
    });
  }

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-6 py-3 text-body text-ink">
        {metric.label}{' '}
        <span className="text-micro text-ink-muted normal-case tracking-normal">
          ({unitSuffix})
        </span>
      </td>
      <td className="px-6 py-3">
        <Select
          aria-label={`comparador de ${metric.label}`}
          value={comparator}
          onChange={(e) => setComparator(e.target.value as 'gte' | 'lte')}
        >
          <option value="gte">≥ meta</option>
          <option value="lte">≤ meta</option>
        </Select>
      </td>
      <td className="px-6 py-3">
        <Input
          aria-label={`meta de ${metric.label}`}
          type="number"
          step="0.1"
          min="0"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          placeholder="—"
          className="w-24"
        />
      </td>
      <td className="px-6 py-3">
        <Input
          aria-label={`margem "quase" de ${metric.label}`}
          type="number"
          step="0.1"
          min="0"
          value={yellowMargin}
          onChange={(e) => setYellowMargin(e.target.value)}
          className="w-24"
        />
      </td>
      <td className="px-6 py-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="solid"
            size="sm"
            disabled={isPending || threshold === ''}
            onClick={handleSave}
          >
            salvar
          </Button>
          {target !== null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={handleRemove}
            >
              remover
            </Button>
          ) : (
            <Badge variant="neutral">sem meta</Badge>
          )}
          <ActionFeedback state={feedback.state} pendingLabel="salvando..." />
        </div>
      </td>
    </tr>
  );
}
