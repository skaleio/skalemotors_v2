/**
 * Paleta de charts INDEPENDIENTE de la marca. Los charts no usan el rosa
 * de la marca porque pierde diferenciación entre series y satura visualmente.
 * Cada valor consume un CSS var --chart-N definido en index.css; cambia
 * automáticamente entre light/dark.
 */
export const CHART_PALETTE = [
  "hsl(var(--chart-1))",  // azul
  "hsl(var(--chart-2))",  // verde
  "hsl(var(--chart-3))",  // ámbar
  "hsl(var(--chart-4))",  // violeta
  "hsl(var(--chart-5))",  // cian
  "hsl(var(--chart-6))",  // coral
];

/** Color del trend principal (línea/área de la métrica destacada). Azul, no rosa. */
export const CHART_PRIMARY = "hsl(var(--chart-1))";

/** Color de eje y grid. */
export const CHART_AXIS = "hsl(var(--muted-foreground))";
export const CHART_GRID = "hsl(var(--border))";
