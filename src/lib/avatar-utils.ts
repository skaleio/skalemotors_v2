import { supabase } from "@/lib/supabase";

/** Tamaño máximo del lado largo del avatar (px). Archivos más pequeños = carga más rápida. */
const AVATAR_MAX_DIMENSION = 256;
const AVATAR_JPEG_QUALITY = 0.85;

/**
 * Redimensiona y comprime una imagen para avatar (canvas).
 * Devuelve un Blob JPEG listo para subir (menor peso y carga más rápida).
 */
export async function optimizeAvatarFile(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      let targetW = w;
      let targetH = h;
      if (w > AVATAR_MAX_DIMENSION || h > AVATAR_MAX_DIMENSION) {
        if (w >= h) {
          targetW = AVATAR_MAX_DIMENSION;
          targetH = Math.round((h * AVATAR_MAX_DIMENSION) / w);
        } else {
          targetH = AVATAR_MAX_DIMENSION;
          targetW = Math.round((w * AVATAR_MAX_DIMENSION) / h);
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file); // fallback: devolver original
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else resolve(file);
        },
        "image/jpeg",
        AVATAR_JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

const AVATAR_BUCKET = "avatars";

type AvatarTransformOptions = {
  size: number;
  /** WebP pesa ~30% menos que JPEG a misma calidad; Supabase lo soporta nativo */
  format?: "webp" | "origin";
  quality?: number;
  /** Sirve para invalidar CDN cuando el archivo cambia en la misma URL */
  cacheBuster?: string | null;
};

function buildTransformUrl(avatarUrl: string, opts: AvatarTransformOptions): string {
  const pathMatch = avatarUrl.match(/\/storage\/v1\/object\/public\/avatars\/(.+)$/);
  if (!pathMatch) return avatarUrl;
  const base = avatarUrl.replace(/\/object\/public\//, "/render/image/public/").split("?")[0];
  const params = new URLSearchParams();
  params.set("width", String(opts.size));
  params.set("height", String(opts.size));
  params.set("quality", String(opts.quality ?? 75));
  params.set("resize", "cover");
  if (opts.format && opts.format !== "origin") params.set("format", opts.format);
  if (opts.cacheBuster) params.set("t", opts.cacheBuster);
  return `${base}?${params.toString()}`;
}

/**
 * URL transformada (tamaño pequeño, calidad y formato WebP) para carga rápida.
 * Si la URL no pertenece al bucket avatars, devuelve la original.
 */
export function getOptimizedAvatarUrl(
  avatarUrl: string | undefined | null,
  size: number = 96,
  cacheBuster?: string | null
): string | undefined {
  if (!avatarUrl?.trim()) return undefined;
  try {
    return buildTransformUrl(avatarUrl, { size, format: "webp", quality: 75, cacheBuster });
  } catch {
    return avatarUrl;
  }
}

/**
 * srcSet con 1x y 2x para pantallas retina. Double-pixel para no verse borroso.
 * Devuelve null si la URL no es del bucket avatars (transform no disponible).
 */
export function getAvatarSrcSet(
  avatarUrl: string | undefined | null,
  size: number,
  cacheBuster?: string | null
): string | undefined {
  if (!avatarUrl?.trim()) return undefined;
  const pathMatch = avatarUrl.match(/\/storage\/v1\/object\/public\/avatars\/(.+)$/);
  if (!pathMatch) return undefined;
  try {
    const url1x = buildTransformUrl(avatarUrl, { size, format: "webp", quality: 75, cacheBuster });
    const url2x = buildTransformUrl(avatarUrl, { size: size * 2, format: "webp", quality: 70, cacheBuster });
    return `${url1x} 1x, ${url2x} 2x`;
  } catch {
    return undefined;
  }
}
