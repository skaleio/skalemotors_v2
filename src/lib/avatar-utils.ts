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

/**
 * Si la URL es de nuestro bucket de avatares, devuelve una URL con transformación
 * (tamaño pequeño + calidad) para cargar más rápido. Si no, devuelve la URL tal cual.
 * cacheBuster evita que el navegador use una imagen en caché tras actualizar el perfil.
 */
export function getOptimizedAvatarUrl(
  avatarUrl: string | undefined | null,
  size: number = 96,
  cacheBuster?: string | null
): string | undefined {
  if (!avatarUrl?.trim()) return undefined;
  try {
    const pathMatch = avatarUrl.match(/\/storage\/v1\/object\/public\/avatars\/(.+)$/);
    const base = pathMatch
      ? avatarUrl.replace(/\/object\/public\//, "/render/image/public/").split("?")[0]
      : avatarUrl.split("?")[0];
    const sep = base.includes("?") ? "&" : "?";
    let url = pathMatch
      ? `${base}${sep}width=${size}&height=${size}&quality=80`
      : avatarUrl;
    if (cacheBuster) {
      url += url.includes("?") ? "&" : "?";
      url += "t=" + encodeURIComponent(cacheBuster);
    }
    return url;
  } catch {
    return avatarUrl;
  }
}
