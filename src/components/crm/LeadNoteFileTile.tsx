import { FileSpreadsheet, FileText, X } from "lucide-react";

import { isImageMime } from "@/lib/leadNoteAttachments";
import { cn } from "@/lib/utils";

function docIcon(name: string, mime?: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const isSheet =
    ext === "xls" || ext === "xlsx" || ext === "csv" || (mime ?? "").includes("sheet") || (mime ?? "").includes("excel");
  return isSheet ? FileSpreadsheet : FileText;
}

type LeadNoteFileTileProps = {
  name: string;
  mime?: string;
  /** URL para mostrar (objectURL de una imagen local o signed URL de una guardada). */
  imageUrl?: string;
  onRemove?: () => void;
  disabled?: boolean;
  /** Resalta el borde (p. ej. archivos nuevos en modo edición). */
  highlight?: boolean;
};

/**
 * Miniatura de un adjunto en el composer: imagen si lo es, o un chip con ícono y
 * nombre para documentos (PDF/Word/Excel/CSV). Opcionalmente muestra el botón de quitar.
 */
export function LeadNoteFileTile({
  name,
  mime,
  imageUrl,
  onRemove,
  disabled,
  highlight,
}: LeadNoteFileTileProps) {
  const isImage = isImageMime(mime, name);
  const Icon = docIcon(name, mime);

  return (
    <div
      className={cn(
        "relative h-16 w-16 overflow-hidden rounded-md border bg-muted",
        highlight ? "border-primary/50" : "border-border/50",
      )}
      title={name}
    >
      {isImage && imageUrl ? (
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center">
          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
          <span className="w-full truncate text-[9px] leading-tight text-muted-foreground">{name}</span>
        </div>
      )}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-foreground shadow hover:bg-background"
          aria-label={`Quitar ${name}`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}
