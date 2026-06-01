type OptimizeVehicleImageOptions = {
  /** Máximo lado (px). */
  maxEdge?: number;
  /** Límite aproximado de bytes del archivo final. */
  maxBytes?: number;
  /** Calidad inicial (0..1). */
  initialQuality?: number;
};

const DEFAULTS: Required<OptimizeVehicleImageOptions> = {
  maxEdge: 1600,
  // 1.2 MB suele ser suficiente para vitrina + app sin matar calidad.
  maxBytes: 1_200_000,
  initialQuality: 0.82,
};

function fileExt(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m?.[1]?.toLowerCase() ?? "";
}

function replaceExt(name: string, nextExt: string): string {
  const ext = fileExt(name);
  if (!ext) return `${name}.${nextExt}`;
  return name.replace(new RegExp(`\\.${ext}$`, "i"), `.${nextExt}`);
}

async function loadBitmap(file: File): Promise<{ bitmap: ImageBitmap; revoke: () => void }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const bitmap = await createImageBitmap(file);
    return { bitmap, revoke: () => URL.revokeObjectURL(objectUrl) };
  } catch {
    // Fallback: usar <img> solo si createImageBitmap falla.
    const img = new Image();
    img.decoding = "async";
    img.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas no disponible");
    ctx.drawImage(img, 0, 0);
    const bitmap = await createImageBitmap(canvas);
    return { bitmap, revoke: () => URL.revokeObjectURL(objectUrl) };
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), type, quality),
  );
  if (!blob) throw new Error("No se pudo codificar la imagen");
  return blob;
}

function chooseOutputType(inputType: string): { type: "image/webp" | "image/jpeg"; ext: "webp" | "jpg" } {
  // WebP por default (mejor compresión). JPEG como fallback seguro.
  // Nota: para fotos de autos no necesitamos alpha; WebP sigue OK.
  if (inputType === "image/webp") return { type: "image/webp", ext: "webp" };
  if (inputType === "image/jpeg" || inputType === "image/jpg") return { type: "image/webp", ext: "webp" };
  if (inputType === "image/png") return { type: "image/webp", ext: "webp" };
  return { type: "image/jpeg", ext: "jpg" };
}

/**
 * Optimiza una imagen antes de subirla al bucket `vehicles`.
 * - Redimensiona a maxEdge
 * - Convierte a WebP (preferido) o JPEG
 * - Ajusta calidad para intentar quedar bajo maxBytes
 */
export async function optimizeVehicleImageForUpload(
  file: File,
  opts?: OptimizeVehicleImageOptions,
): Promise<File> {
  const { maxEdge, maxBytes, initialQuality } = { ...DEFAULTS, ...(opts ?? {}) };

  // No tocar formatos no imagen o GIF (animaciones) para evitar perder movimiento.
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;

  const { type, ext } = chooseOutputType(file.type);

  let bitmap: ImageBitmap | null = null;
  let revoke = () => {};
  try {
    const loaded = await loadBitmap(file);
    bitmap = loaded.bitmap;
    revoke = loaded.revoke;

    const srcW = bitmap.width;
    const srcH = bitmap.height;
    const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
    let targetW = Math.max(1, Math.round(srcW * scale));
    let targetH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // Ajuste iterativo: baja calidad y, si sigue muy grande, baja un poco dimensiones.
    let quality = initialQuality;
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = targetW;
      canvas.height = targetH;
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);

      const blob = await canvasToBlob(canvas, type, quality);
      if (blob.size <= maxBytes || (targetW <= 900 && targetH <= 900)) {
        return new File([blob], replaceExt(file.name, ext), { type });
      }

      // Primera fase: bajar calidad hasta un mínimo razonable.
      if (quality > 0.68) {
        quality = Math.max(0.68, quality - 0.07);
        continue;
      }

      // Segunda fase: bajar dimensiones ~10%.
      targetW = Math.max(1, Math.round(targetW * 0.9));
      targetH = Math.max(1, Math.round(targetH * 0.9));
    }

    // Último intento: devolver con lo último que tenemos (aunque no cumpla maxBytes).
    canvas.width = targetW;
    canvas.height = targetH;
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    const blob = await canvasToBlob(canvas, type, Math.max(0.65, initialQuality));
    return new File([blob], replaceExt(file.name, ext), { type });
  } catch {
    return file;
  } finally {
    try {
      bitmap?.close();
    } catch {
      // ignore
    }
    revoke();
  }
}

