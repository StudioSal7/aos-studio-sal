/**
 * Categorização automática por regra (Fatia 10, opcional): a descrição da
 * linha do extrato contém `pattern` (case-insensitive) → sugere a categoria.
 * Puro. Maior `priority` é checada primeiro; a primeira regra que casar
 * vence. Retorna `null` se nenhuma regra casar — a categoria continua sendo
 * escolha do owner, isso é só um palpite pré-preenchido.
 */

export interface CategorizationRuleInput {
  pattern: string;
  categoryId: string;
  priority: number;
}

export function matchCategorizationRule(
  description: string,
  rules: CategorizationRuleInput[],
): string | null {
  const normalizedDescription = description.toLowerCase();
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    const pattern = rule.pattern.trim().toLowerCase();
    if (pattern.length === 0) continue;
    if (normalizedDescription.includes(pattern)) return rule.categoryId;
  }

  return null;
}
