import { describe, expect, it } from 'vitest';
import { projectCashflow } from './index';

const TODAY = new Date('2026-07-15T12:00:00Z'); // meio de julho/2026

describe('projectCashflow', () => {
  it('sem entradas/saídas: saldo permanece igual em todos os meses', () => {
    const result = projectCashflow({
      startingBalanceCents: 100000,
      openEntries: [],
      recurringTemplates: [],
      horizonMonths: 3,
      today: TODAY,
    });
    expect(result.months).toHaveLength(3);
    expect(result.months.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(result.months.every((m) => m.saldoFinalCents === 100000)).toBe(true);
    expect(result.saldoFinalCents).toBe(100000);
    expect(result.temMesNegativo).toBe(false);
  });

  it('conta em aberto vencendo no mês atual entra no mês certo', () => {
    const result = projectCashflow({
      startingBalanceCents: 0,
      openEntries: [{ kind: 'receita', amountCents: 5000, dueDate: '2026-07-20' }],
      recurringTemplates: [],
      horizonMonths: 2,
      today: TODAY,
    });
    expect(result.months[0]!.entradasCents).toBe(5000);
    expect(result.months[0]!.saldoFinalCents).toBe(5000);
    expect(result.months[1]!.entradasCents).toBe(0);
    expect(result.months[1]!.saldoInicialCents).toBe(5000);
  });

  it('conta em aberto vencendo no mês seguinte não afeta o mês atual', () => {
    const result = projectCashflow({
      startingBalanceCents: 1000,
      openEntries: [{ kind: 'despesa', amountCents: 300, dueDate: '2026-08-05' }],
      recurringTemplates: [],
      horizonMonths: 2,
      today: TODAY,
    });
    expect(result.months[0]!.saidasCents).toBe(0);
    expect(result.months[0]!.saldoFinalCents).toBe(1000);
    expect(result.months[1]!.saidasCents).toBe(300);
    expect(result.months[1]!.saldoFinalCents).toBe(700);
  });

  it('recorrência ativa desde antes do horizonte conta em todos os meses', () => {
    const result = projectCashflow({
      startingBalanceCents: 0,
      openEntries: [],
      recurringTemplates: [
        { kind: 'despesa', amountCents: 200000, startDate: '2026-01-01', endDate: null },
      ],
      horizonMonths: 3,
      today: TODAY,
    });
    expect(result.months.every((m) => m.saidasCents === 200000)).toBe(true);
    expect(result.saldoFinalCents).toBe(-600000);
    expect(result.temMesNegativo).toBe(true);
  });

  it('recorrência com endDate para de contar após o fim', () => {
    const result = projectCashflow({
      startingBalanceCents: 0,
      openEntries: [],
      recurringTemplates: [
        { kind: 'despesa', amountCents: 100, startDate: '2026-01-01', endDate: '2026-08-01' },
      ],
      horizonMonths: 3, // jul, ago, set
      today: TODAY,
    });
    expect(result.months[0]!.saidasCents).toBe(100); // julho
    expect(result.months[1]!.saidasCents).toBe(100); // agosto (última vigência)
    expect(result.months[2]!.saidasCents).toBe(0); // setembro — já encerrou
  });

  it('recorrência que começa no meio do horizonte só conta a partir de lá', () => {
    const result = projectCashflow({
      startingBalanceCents: 0,
      openEntries: [],
      recurringTemplates: [
        { kind: 'receita', amountCents: 500, startDate: '2026-08-01', endDate: null },
      ],
      horizonMonths: 3,
      today: TODAY,
    });
    expect(result.months[0]!.entradasCents).toBe(0); // julho — ainda não começou
    expect(result.months[1]!.entradasCents).toBe(500); // agosto
    expect(result.months[2]!.entradasCents).toBe(500); // setembro
  });

  it('encadeamento: saldo final de um mês é o saldo inicial do próximo', () => {
    const result = projectCashflow({
      startingBalanceCents: 1000,
      openEntries: [{ kind: 'receita', amountCents: 500, dueDate: '2026-07-10' }],
      recurringTemplates: [],
      horizonMonths: 2,
      today: TODAY,
    });
    expect(result.months[1]!.saldoInicialCents).toBe(result.months[0]!.saldoFinalCents);
  });

  it('detecta mês com saldo negativo mesmo que o saldo final geral seja positivo', () => {
    const result = projectCashflow({
      startingBalanceCents: 100,
      openEntries: [
        { kind: 'despesa', amountCents: 500, dueDate: '2026-07-10' },
        { kind: 'receita', amountCents: 1000, dueDate: '2026-08-10' },
      ],
      recurringTemplates: [],
      horizonMonths: 2,
      today: TODAY,
    });
    expect(result.months[0]!.saldoFinalCents).toBe(-400);
    expect(result.temMesNegativo).toBe(true);
    expect(result.saldoFinalCents).toBe(600);
  });

  it('é determinístico (mesmo input, mesmo output)', () => {
    const input = {
      startingBalanceCents: 100,
      openEntries: [{ kind: 'receita' as const, amountCents: 50, dueDate: '2026-07-10' }],
      recurringTemplates: [],
      horizonMonths: 1,
      today: TODAY,
    };
    expect(projectCashflow(input)).toEqual(projectCashflow(input));
  });
});
