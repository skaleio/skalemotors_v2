// Lógica pura de tasación de mercado a partir de anuncios reales (Chileautos).
// Sin imports: la importa el Edge Function (Deno) y el test de vitest (node).

export interface RawListing {
  precioRaw: string | null;
  titulo: string;
  detalles: string[];
  url: string | null;
}

export interface MarketMuestra {
  titulo: string;
  precio: number;
  año: number;
  kilometros: number | null;
  url: string;
}

export interface MarketSummary {
  muestras: MarketMuestra[];
  precio_minimo: number;
  precio_promedio: number;
  precio_mediana: number;
  precio_maximo: number;
  total_muestras: number;
  confianza: "alta" | "media" | "baja";
}

/** Extrae un precio numérico desde el atributo data-webm-price o un texto "$ 12.990.000". */
export function parsePrecio(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Detecta el año del vehículo en el título (ej: "Toyota Yaris 1.5 2019"). */
export function parseAnio(titulo: string, currentYear: number): number | null {
  const matches = titulo.match(/\b(?:19|20)\d{2}\b/g);
  if (!matches) return null;
  const plausibles = matches
    .map((m) => Number(m))
    .filter((y) => y >= 1980 && y <= currentYear + 1);
  if (plausibles.length === 0) return null;
  // El año del modelo suele ser el mayor valor plausible del título.
  return Math.max(...plausibles);
}

/** Extrae el kilometraje desde los detalles del anuncio (ej: "45.000 km"). */
export function parseKilometros(detalles: string[]): number | null {
  for (const detalle of detalles) {
    if (!/km/i.test(detalle)) continue;
    const digits = detalle.replace(/[^\d]/g, "");
    if (!digits) continue;
    const value = Number(digits);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function mediana(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function clasificarConfianza(n: number): "alta" | "media" | "baja" {
  if (n >= 8) return "alta";
  if (n >= 4) return "media";
  return "baja";
}

/**
 * Convierte anuncios crudos en una tasación de mercado.
 * Filtra por año del vehículo ±toleranciaAños (ignora km, por decisión de producto).
 * Si targetYear es null, conserva todos los anuncios con precio válido.
 */
export function summarizeListings(
  raw: RawListing[],
  targetYear: number | null,
  currentYear: number,
  toleranciaAños = 2,
): MarketSummary {
  const muestras: MarketMuestra[] = [];

  for (const item of raw) {
    const precio = parsePrecio(item.precioRaw);
    if (precio == null) continue;
    const año = parseAnio(item.titulo, currentYear);
    if (targetYear != null) {
      if (año == null) continue;
      if (Math.abs(año - targetYear) > toleranciaAños) continue;
    }
    muestras.push({
      titulo: item.titulo.trim() || "Anuncio sin título",
      precio,
      año: año ?? targetYear ?? currentYear,
      kilometros: parseKilometros(item.detalles),
      url: item.url ?? "",
    });
  }

  const precios = muestras.map((m) => m.precio);
  const total = precios.length;
  const suma = precios.reduce((acc, p) => acc + p, 0);

  return {
    muestras,
    precio_minimo: total > 0 ? Math.min(...precios) : 0,
    precio_promedio: total > 0 ? Math.round(suma / total) : 0,
    precio_mediana: mediana(precios),
    precio_maximo: total > 0 ? Math.max(...precios) : 0,
    total_muestras: total,
    confianza: clasificarConfianza(total),
  };
}
