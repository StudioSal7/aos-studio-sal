// Constantes das vistas — módulo compartilhado SEM 'use client': o server
// component (page.tsx) chama isVistaKey() e o client (vista-tabs) renderiza os
// botões. Função exportada de módulo client vira client reference e QUEBRA se
// chamada no server — por isso este arquivo existe separado.

export const VISTAS = [
  { key: 'decisao', label: 'decisão' },
  { key: 'curva', label: 'curva' },
  { key: 'tendencia', label: 'tendência' },
] as const;

export type VistaKey = (typeof VISTAS)[number]['key'];

export function isVistaKey(v: string | undefined): v is VistaKey {
  return VISTAS.some((t) => t.key === v);
}
