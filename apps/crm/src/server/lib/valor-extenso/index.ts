/**
 * Valor por extenso (pt-BR) para contratos — converte cents (integer) em texto,
 * ex.: 199700 → "mil novecentos e noventa e sete reais".
 *
 * Regra de junção do "e" entre grupos (milhão/mil/unidades): usa "e" antes do
 * último grupo não-vazio quando ele é < 100 OU é um múltiplo exato de 100
 * (ex.: "mil e duzentos", "mil e trinta e cinco"); caso contrário concatena
 * sem "e" (ex.: "mil duzentos e trinta e cinco", pois 235 não é < 100 nem
 * múltiplo de 100). Mesma regra vale entre milhão e milhar.
 *
 * R$0,00 sem centavos e sem reais nunca ocorre em venda real — mas cents=0
 * cai em "zero reais" por segurança (nunca lança).
 */

const UNITS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const TEENS = [
  'dez',
  'onze',
  'doze',
  'treze',
  'catorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
];
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const HUNDREDS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
];

/** n em 1..99 */
function twoDigitsToWords(n: number): string {
  if (n < 10) return UNITS[n] ?? '';
  if (n < 20) return TEENS[n - 10] ?? '';
  const t = Math.floor(n / 10);
  const u = n % 10;
  const tensWord = TENS[t] ?? '';
  if (u === 0) return tensWord;
  return `${tensWord} e ${UNITS[u] ?? ''}`;
}

/** n em 0..999 */
function hundredsGroupToWords(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(HUNDREDS[h] ?? '');
  if (rest > 0) {
    if (parts.length) parts.push('e');
    parts.push(twoDigitsToWords(rest));
  }
  return parts.join(' ');
}

type Group = { value: number; words: string };

/** Junta grupos (milhão/milhar/unidade) aplicando a regra do "e" no último grupo. */
function joinGroups(groups: Group[]): string {
  const nonEmpty = groups.filter((g) => g.words);
  if (nonEmpty.length === 0) return 'zero';
  if (nonEmpty.length === 1) return nonEmpty[0]?.words ?? 'zero';
  const last = nonEmpty[nonEmpty.length - 1];
  if (!last) return 'zero';
  const head = nonEmpty
    .slice(0, -1)
    .map((g) => g.words)
    .join(' ');
  const useE = last.value < 100 || last.value % 100 === 0;
  return useE ? `${head} e ${last.words}` : `${head} ${last.words}`;
}

/** n inteiro >= 0 */
function integerToWords(n: number): string {
  if (n === 0) return 'zero';

  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const units = n % 1000;

  const groups: Group[] = [];

  if (millions > 0) {
    const word = millions === 1 ? 'milhão' : 'milhões';
    const millionsWords = millions === 1 ? word : `${hundredsGroupToWords(millions)} ${word}`;
    groups.push({ value: millions, words: millionsWords });
  }

  if (thousands > 0) {
    const thousandsWords = thousands === 1 ? 'mil' : `${hundredsGroupToWords(thousands)} mil`;
    groups.push({ value: thousands, words: thousandsWords });
  }

  if (units > 0) {
    groups.push({ value: units, words: hundredsGroupToWords(units) });
  }

  return joinGroups(groups);
}

/** cents inteiro (pode vir negativo/fracionário por engano de fronteira — normaliza defensivamente) → texto pt-BR. */
export function valorPorExtenso(cents: number): string {
  const totalCents = Number.isFinite(cents) ? Math.round(Math.abs(cents)) : 0;
  const reais = Math.floor(totalCents / 100);
  const centavos = totalCents % 100;

  const reaisWords = integerToWords(reais);
  const reaisUnit = reais === 1 ? 'real' : 'reais';

  if (centavos === 0) {
    return `${reaisWords} ${reaisUnit}`;
  }

  const centavosWords = integerToWords(centavos);
  const centavosUnit = centavos === 1 ? 'centavo' : 'centavos';

  if (reais === 0) {
    return `${centavosWords} ${centavosUnit}`;
  }

  return `${reaisWords} ${reaisUnit} e ${centavosWords} ${centavosUnit}`;
}
