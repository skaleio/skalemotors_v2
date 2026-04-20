/**
 * Convierte una URL pública de Storage (…/object/public/…) en URL de transformación
 * (…/render/image/public/…) para reducir ancho/alto y peso en listados.
 * Si no es de Supabase Storage, devuelve la URL original.
 */
export function toSupabaseTransformedImageUrl(
  publicObjectUrl: string | null | undefined,
  opts: { width: number; height?: number; quality?: number; resize?: "cover" | "contain" }
): string | undefined {
  if (!publicObjectUrl?.trim()) return undefined;
  const raw = publicObjectUrl.trim();
  if (!raw.includes("/storage/v1/object/public/")) return raw;
  const withoutQuery = raw.split("?")[0];
  const base = withoutQuery.replace("/object/public/", "/render/image/public/");
  const height = opts.height ?? opts.width;
  const q = opts.quality ?? 72;
  const resize = opts.resize ?? "cover";
  return `${base}?width=${opts.width}&height=${height}&resize=${resize}&quality=${q}`;
}
