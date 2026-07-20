/**
 * ads-decision-engine — motor de decisão por criativo × segmento. PURO.
 *
 * Consome métricas de janela 7d fechada em D-3 (ads-metrics/ads-windows) e
 * devolve UMA flag com motivo em texto (auditável, padrão dossiê — o número
 * que disparou a regra vai na frase). Decisão vira flag; humano executa.
 * Stop-loss automatizado continua sendo regra configurada no Ads Manager.
 *
 * Ordem de avaliação (curto-circuito):
 *   1. sem_alvo            — targets null (estado inicial) → fallback honesto, nunca chuta
 *   2. matar (stop-loss)   — 2× CPA alvo gasto SEM NENHUMA conversão → mata mesmo
 *      abaixo da barra de teste (3×) — sinal mais urgente que "sem veredito"
 *   3. volume_insuficiente — gasto < testBar (3× CPA alvo) → sem veredito, ponto final
 *      (avaliado ANTES de winner: ROAS alto com gasto de teste não prova nada)
 *   4. winner              — ROAS ≥ 10× → bunker (fonte de variações)
 *   5. matar (piso)        — ROAS < piso com volume provado
 *   6. escalar             — CPA ≤ alvo E ROAS ≥ piso com volume
 *   7. iterar              — volume ok, performance entre o piso e o alvo
 *
 * fadiga é flag ORTOGONAL (coexiste com qualquer veredito): CPA↑ + hook↓ +
 * frequência(proxy)↑ SIMULTÂNEOS WoW. Qualquer métrica incomputável em um dos
 * lados → false: flag falsa de fadiga mata criativo saudável — o custo
 * assimétrico favorece o falso negativo.
 */

import type { AdsRules, AdsTargets } from '@/lib/ads.config';
import type { WindowMetrics } from '../ads-metrics/index';

export type DecisionFlag =
  | 'sem_alvo'
  | 'volume_insuficiente'
  | 'matar'
  | 'winner'
  | 'escalar'
  | 'iterar';

export interface Decision {
  flag: DecisionFlag;
  reason: string;
  fadiga: boolean;
  fadigaReason: string | null;
}

export interface DecisionInput {
  /** Janela de decisão (7d fechada em D-3). */
  current: WindowMetrics;
  /** Janela imediatamente anterior (WoW) — null se não computável. */
  previous: WindowMetrics | null;
  /** Alvos DO SEGMENTO do criativo — nunca blended. */
  targets: AdsTargets;
  rules: AdsRules;
}

function brl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

export function detectFadiga(
  current: WindowMetrics,
  previous: WindowMetrics | null,
): { fadiga: boolean; reason: string | null } {
  if (!previous) return { fadiga: false, reason: null };

  const pairs: Array<[number | null, number | null]> = [
    [current.cpaCents, previous.cpaCents],
    [current.hookRate, previous.hookRate],
    [current.frequencyProxy, previous.frequencyProxy],
  ];
  if (pairs.some(([a, b]) => a === null || b === null)) return { fadiga: false, reason: null };
  if (previous.totals.impressions === 0) return { fadiga: false, reason: null };

  const cpaUp = current.cpaCents! > previous.cpaCents!;
  const hookDown = current.hookRate! < previous.hookRate!;
  const freqUp = current.frequencyProxy! > previous.frequencyProxy!;

  if (cpaUp && hookDown && freqUp) {
    return {
      fadiga: true,
      reason:
        `fadiga: CPA ${brl(previous.cpaCents!)}→${brl(current.cpaCents!)} ↑, ` +
        `hook ${pct(previous.hookRate!)}→${pct(current.hookRate!)} ↓, ` +
        `frequência (proxy) ${previous.frequencyProxy!.toFixed(2)}→${current.frequencyProxy!.toFixed(2)} ↑ WoW.`,
    };
  }
  return { fadiga: false, reason: null };
}

export function decide(input: DecisionInput): Decision {
  const { current, previous, targets, rules } = input;
  const { fadiga, reason: fadigaReason } = detectFadiga(current, previous);
  const spend = current.totals.spendCents;
  const purchases = current.totals.purchases;
  const { roas, cpaCents } = current;

  if (targets.cpaTargetCents === null || targets.roasFloor === null) {
    return {
      flag: 'sem_alvo',
      reason:
        'alvos do segmento não definidos — cravar CPA alvo e piso de ROAS por segmento após o backfill separar frio/quente.',
      fadiga,
      fadigaReason,
    };
  }

  // Stop-loss de zero conversão é checado ANTES da barra de volume: é um sinal
  // mais urgente ("gastou e não vendeu NADA") que não pode esperar a barra de
  // teste (3×) só porque ela é maior que o próprio stop-loss (2×) — senão a
  // zona [2×, 3×) fica "sem veredito" quando já deveria ser matar.
  const stopLoss = rules.stopLossMultiple * targets.cpaTargetCents;
  if (purchases === 0 && spend >= stopLoss) {
    return {
      flag: 'matar',
      reason: `${brl(spend)} gastos (≥ ${rules.stopLossMultiple}× CPA alvo ${brl(targets.cpaTargetCents)}) sem nenhuma conversão.`,
      fadiga,
      fadigaReason,
    };
  }

  const testBar = rules.testBarMultiple * targets.cpaTargetCents;
  if (spend < testBar) {
    return {
      flag: 'volume_insuficiente',
      reason: `gasto ${brl(spend)} abaixo da barra de teste ${brl(testBar)} (${rules.testBarMultiple}× CPA alvo) — sem veredito.`,
      fadiga,
      fadigaReason,
    };
  }

  if (roas !== null && roas >= rules.winnerMultiple) {
    return {
      flag: 'winner',
      reason: `retorno ${roas.toFixed(1)}x ≥ ${rules.winnerMultiple}x com ${brl(spend)} de volume — bunker (fonte de variações).`,
      fadiga,
      fadigaReason,
    };
  }

  if (roas !== null && roas < targets.roasFloor) {
    return {
      flag: 'matar',
      reason: `ROAS ${roas.toFixed(2)}x abaixo do piso ${targets.roasFloor.toFixed(1)}x com volume provado (${brl(spend)}).`,
      fadiga,
      fadigaReason,
    };
  }

  if (cpaCents !== null && cpaCents <= targets.cpaTargetCents && roas !== null && roas >= targets.roasFloor) {
    return {
      flag: 'escalar',
      reason: `CPA ${brl(cpaCents)} ≤ alvo ${brl(targets.cpaTargetCents)} e ROAS ${roas.toFixed(2)}x ≥ piso ${targets.roasFloor.toFixed(1)}x, com volume (${brl(spend)}).`,
      fadiga,
      fadigaReason,
    };
  }

  return {
    flag: 'iterar',
    reason: `volume ok (${brl(spend)}), performance entre o piso e o alvo (CPA ${cpaCents === null ? '—' : brl(cpaCents)}, ROAS ${roas === null ? '—' : `${roas.toFixed(2)}x`}) — iterar o criativo.`,
    fadiga,
    fadigaReason,
  };
}
