// Formatação compartilhada da página de tráfego. Convenção do ads-metrics:
// dinheiro em cents, taxas como fração 0–1, null → travessão (nunca NaN/Infinity).

const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function brl(cents: number | null): string {
  return cents === null ? '—' : brlFmt.format(cents / 100);
}

export function pct(fraction: number | null, digits = 1): string {
  return fraction === null ? '—' : `${(fraction * 100).toFixed(digits)}%`;
}

export function roasX(roas: number | null): string {
  return roas === null ? '—' : `${roas.toFixed(2)}x`;
}

export function num(n: number | null, digits = 2): string {
  return n === null ? '—' : n.toFixed(digits);
}

/** '2026-07-13' → '13/07' */
export function shortDay(day: string): string {
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
}
