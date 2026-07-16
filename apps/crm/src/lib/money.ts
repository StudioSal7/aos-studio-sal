// Dinheiro em integer cents em todo lugar — formatação/parse só aqui, na borda com o usuário.

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return fmtBRL.format(cents / 100);
}

// Input decimal em reais (ex: "1997.00" ou "1997,50") → integer cents.
// String vazia/inválida → null (fallback honesto, sem chute).
export function centsFromReaisInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const reais = Number(normalized);
  if (!Number.isFinite(reais)) return null;
  return Math.round(reais * 100);
}

export function reaisInputFromCents(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}
