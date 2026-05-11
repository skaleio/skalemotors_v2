/**
 * Paleta tokenizada para Recharts. Cada valor es un string CSS color válido
 * que Recharts pasa directo al SVG. Lee CSS vars del tema actual, así
 * cambia automáticamente entre light/dark.
 */
export const CHART_PALETTE = [
  "hsl(var(--primary))",      // rosa marca
  "hsl(var(--info))",         // cian info
  "hsl(var(--success))",      // verde
  "hsl(var(--warning))",      // ámbar
  "hsl(var(--destructive))",  // rojo
  "hsl(265 70% 60%)",         // violeta acento (complemento, no token)
];

/** Color del trend principal (línea/área de la métrica destacada). */
export const CHART_PRIMARY = "hsl(var(--primary))";

/** Color de eje y grid. */
export const CHART_AXIS = "hsl(var(--muted-foreground))";
export const CHART_GRID = "hsl(var(--border))";
