// Paleta consistente com o design system minimalista (ink, canvas, paper).
// Cores semânticas alinhadas ao kind do estágio.
export const CHART_COLORS = {
  ink: '#1c1917',
  inkMuted: '#78716c',
  line: '#e7e5e4',
  paper: '#fafaf9',
  canvas: '#f5f5f4',
  open: '#3b82f6',
  won: '#047857',
  lost: '#dc2626',
  notWorked: '#a8a29e',
  fake: '#b91c1c',
  noReturn: '#d97706',
  series: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'],
} as const;

export const CHART_TYPOGRAPHY = {
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 400,
  letterSpacing: 0,
} as const;
