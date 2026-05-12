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
] as const;

/** Color del trend principal (línea/área de la métrica destacada). Azul, no rosa. */
export const CHART_PRIMARY = "hsl(var(--chart-1))";

/** Color de eje y grid. */
export const CHART_AXIS = "hsl(var(--muted-foreground))";
export const CHART_GRID = "hsl(var(--border))";

/**
 * Tooltip props consistente para TODOS los charts del SaaS.
 * Popover tokenizado, sombra suave, padding compacto.
 *
 * Uso:
 *   <Tooltip {...CHART_TOOLTIP_PROPS} formatter={...} />
 */
export const CHART_TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: "hsl(var(--popover))",
    color: "hsl(var(--popover-foreground))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.12), 0 2px 6px -2px rgb(0 0 0 / 0.08)",
    padding: "10px 14px",
  },
  labelStyle: {
    color: "hsl(var(--popover-foreground))",
    fontWeight: 600 as const,
    marginBottom: 4,
  },
  itemStyle: {
    color: "hsl(var(--popover-foreground))",
  },
  cursor: { fill: "hsl(var(--muted))", opacity: 0.3 },
} as const;

/** Tick props para XAxis/YAxis (color muted + tabular nums + tamaño compacto). */
export const CHART_AXIS_TICK = {
  fontSize: 11,
  fill: "hsl(var(--muted-foreground))",
  fontVariantNumeric: "tabular-nums" as const,
} as const;

/** Props comunes de CartesianGrid: sólo líneas horizontales, color tenue. */
export const CHART_GRID_PROPS = {
  strokeDasharray: "3 3",
  stroke: "hsl(var(--border))",
  strokeOpacity: 0.5,
  vertical: false,
} as const;

/** Default radius para barras (esquinas superiores redondeadas). */
export const CHART_BAR_RADIUS: [number, number, number, number] = [6, 6, 0, 0];

/** Default props para Line dots — punto chico con anillo del color del card. */
export function chartDotProps(color: string) {
  return {
    fill: color,
    r: 3,
    strokeWidth: 2,
    stroke: "hsl(var(--card))",
  };
}

/** Default props para activeDot (cuando el cursor está encima). */
export function chartActiveDotProps() {
  return {
    r: 5,
    strokeWidth: 2,
    stroke: "hsl(var(--card))",
  };
}
