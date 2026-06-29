import { getZernioMediaPresign } from "@/lib/services/zernioApi";

export const ZERNIO_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB — tope práctico para la UI
export const MAX_IMAGES_PER_POST = 10; // límite del carrusel de Instagram

export type ZernioMediaItem = { url: string; type: "image" };

function humanSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Valida y sube una imagen a Zernio (presign → PUT a R2). Devuelve la URL pública. */
export async function uploadZernioImage(file: File): Promise<ZernioMediaItem> {
  if (!ZERNIO_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`«${file.name}»: formato no permitido. Usa JPG, PNG, WebP o GIF.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`«${file.name}» pesa ${humanSize(file.size)} (máx ${humanSize(MAX_IMAGE_BYTES)}).`);
  }

  const { uploadUrl, publicUrl } = await getZernioMediaPresign(file.name, file.type);

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`No se pudo subir «${file.name}» (HTTP ${res.status}).`);
  }

  return { url: publicUrl, type: "image" };
}
