/** Metadata de una imagen adjunta a una nota, tal como se guarda en lead_notes.attachments. */
export type LeadNoteAttachment = {
  path: string;
  name: string;
  size: number;
  mime: string;
  width?: number;
  height?: number;
};

/** Adjunto enriquecido con la signed URL para mostrarlo (no se persiste). */
export type LeadNoteAttachmentWithUrl = LeadNoteAttachment & { url: string };

export const LEAD_NOTE_ATTACHMENTS_BUCKET = "lead-note-attachments";

/** Tope del archivo original antes de optimizar; evita cargar archivos enormes al canvas. */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024; // 25 MB

export const ACCEPTED_IMAGE_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

function safeExt(fileName: string, mime: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

/** Path en el bucket: {tenant_id}/{lead_id}/{note_id}/{timestamp}-{rand}.{ext}. */
export function buildLeadNoteAttachmentPath(params: {
  tenantId: string;
  leadId: string;
  noteId: string;
  fileName: string;
  mime: string;
  now?: number;
  rand?: string;
}): string {
  const ext = safeExt(params.fileName, params.mime);
  const stamp = params.now ?? Date.now();
  const rand = params.rand ?? Math.random().toString(36).slice(2, 10);
  return `${params.tenantId}/${params.leadId}/${params.noteId}/${stamp}-${rand}.${ext}`;
}

export type AttachmentRejection = { name: string; reason: string };

export type AttachmentSelection = {
  accepted: File[];
  rejected: AttachmentRejection[];
};

/**
 * Filtra la selección de archivos respetando tipo y tamaño. Sin límite de
 * cantidad: cada imagen se comprime antes de subir. Lógica pura para testear
 * la validación sin tocar el DOM ni la red.
 */
export function selectValidAttachments(params: { files: File[] }): AttachmentSelection {
  const accepted: File[] = [];
  const rejected: AttachmentRejection[] = [];

  for (const file of params.files) {
    if (!file.type.startsWith("image/") || !ACCEPTED_IMAGE_MIME.includes(file.type as never)) {
      rejected.push({ name: file.name, reason: "No es una imagen compatible." });
      continue;
    }
    if (file.size > MAX_INPUT_BYTES) {
      rejected.push({ name: file.name, reason: "Supera el tamaño máximo (25 MB)." });
      continue;
    }
    accepted.push(file);
  }

  return { accepted, rejected };
}

/** Normaliza el jsonb crudo de la BD a un arreglo de adjuntos válido. */
export function parseAttachments(raw: unknown): LeadNoteAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const a = item as Record<string, unknown>;
    if (typeof a.path !== "string" || !a.path) return [];
    return [
      {
        path: a.path,
        name: typeof a.name === "string" ? a.name : "imagen",
        size: typeof a.size === "number" ? a.size : 0,
        mime: typeof a.mime === "string" ? a.mime : "image/jpeg",
        width: typeof a.width === "number" ? a.width : undefined,
        height: typeof a.height === "number" ? a.height : undefined,
      },
    ];
  });
}
