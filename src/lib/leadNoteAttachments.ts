/** Metadata de un adjunto de una nota, tal como se guarda en lead_notes.attachments. */
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

/** Tope del archivo de imagen original antes de optimizar (se comprime al subir). */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024; // 25 MB

/** Tope real de un documento: no se comprime, así que es el límite del bucket. */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB

export const ACCEPTED_IMAGE_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/** Documentos que el cliente suele mandar: PDF, Word, Excel, CSV. */
export const ACCEPTED_DOC_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
] as const;

/** Extensión → mime, para cuando el navegador manda file.type vacío u octet-stream. */
const DOC_EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};

/** Valor del atributo `accept` del <input type=file>: imágenes + documentos. */
export const ATTACHMENT_ACCEPT = [
  "image/*",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ...ACCEPTED_DOC_MIME,
].join(",");

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** ¿El adjunto es una imagen? Usa el mime y cae a la extensión si el mime falta. */
export function isImageMime(mime?: string | null, name?: string): boolean {
  if (mime && mime.startsWith("image/")) return true;
  if (mime && ACCEPTED_DOC_MIME.includes(mime as never)) return false;
  const ext = name ? extOf(name) : "";
  return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
}

/** Mime con el que se sube el archivo: el del navegador o el deducido de la extensión. */
export function resolveUploadMime(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  return DOC_EXT_TO_MIME[extOf(file.name)] ?? file.type ?? "application/octet-stream";
}

function isAcceptedAttachment(file: File): boolean {
  const mime = resolveUploadMime(file);
  if (mime.startsWith("image/") && ACCEPTED_IMAGE_MIME.includes(mime as never)) return true;
  return ACCEPTED_DOC_MIME.includes(mime as never);
}

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
 * Filtra la selección respetando tipo y tamaño. Acepta imágenes (se comprimen al
 * subir) y documentos (PDF/Word/Excel/CSV, tal cual). Sin límite de cantidad.
 * Lógica pura para testear la validación sin tocar el DOM ni la red.
 */
export function selectValidAttachments(params: {
  files: File[];
  existingCount?: number;
}): AttachmentSelection {
  const accepted: File[] = [];
  const rejected: AttachmentRejection[] = [];

  for (const file of params.files) {
    if (!isAcceptedAttachment(file)) {
      rejected.push({
        name: file.name,
        reason: "Formato no admitido. Usa imágenes, PDF, Word, Excel o CSV.",
      });
      continue;
    }
    const isImage = isImageMime(resolveUploadMime(file), file.name);
    const maxBytes = isImage ? MAX_INPUT_BYTES : MAX_ATTACHMENT_BYTES;
    if (file.size > maxBytes) {
      rejected.push({
        name: file.name,
        reason: `Supera el tamaño máximo (${Math.round(maxBytes / 1024 / 1024)} MB).`,
      });
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
        name: typeof a.name === "string" ? a.name : "archivo",
        size: typeof a.size === "number" ? a.size : 0,
        mime: typeof a.mime === "string" ? a.mime : "application/octet-stream",
        width: typeof a.width === "number" ? a.width : undefined,
        height: typeof a.height === "number" ? a.height : undefined,
      },
    ];
  });
}
