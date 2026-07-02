/**
 * Normaliza una patente chilena para almacenar y comparar:
 * mayúsculas y solo alfanuméricos ("bc-df 12" → "BCDF12").
 * El enlace consignación↔vehículo depende de esta forma canónica.
 */
export function normalizePatente(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized || null;
}
