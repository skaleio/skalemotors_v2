import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { isImageMime, type LeadNoteAttachmentWithUrl } from "@/lib/leadNoteAttachments";
import { cn } from "@/lib/utils";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";

type LeadNoteAttachmentsProps = {
  attachments?: LeadNoteAttachmentWithUrl[];
  className?: string;
};

function docIcon(name: string, mime: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const isSheet =
    ext === "xls" || ext === "xlsx" || ext === "csv" || mime.includes("sheet") || mime.includes("excel");
  return isSheet ? FileSpreadsheet : FileText;
}

/**
 * Adjuntos de una nota. Las imágenes se muestran como miniaturas (lightbox al
 * hacer click); los documentos (PDF/Word/Excel/CSV) como chips para descargar/abrir.
 */
export function LeadNoteAttachments({ attachments, className }: LeadNoteAttachmentsProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!attachments?.length) return null;

  const images = attachments.filter((a) => isImageMime(a.mime, a.name));
  const docs = attachments.filter((a) => !isImageMime(a.mime, a.name));
  const current = openIndex !== null ? images[openIndex] : null;

  return (
    <div className={cn("mt-2 space-y-2", className)}>
      {images.length ? (
        <div className="flex flex-wrap gap-2">
          {images.map((att, i) => (
            <button
              key={att.path}
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group relative h-16 w-16 overflow-hidden rounded-md border border-border/50 bg-muted"
              title={att.name}
              aria-label={`Ampliar imagen ${att.name}`}
            >
              <img
                src={att.url}
                alt={att.name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      ) : null}

      {docs.length ? (
        <div className="flex flex-col gap-1.5">
          {docs.map((att) => {
            const Icon = docIcon(att.name, att.mime);
            return (
              <a
                key={att.path}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                download={att.name}
                className="group flex items-center gap-2 rounded-md border border-border/50 bg-background/60 px-2.5 py-1.5 text-sm transition-colors hover:bg-muted"
                title={`Abrir ${att.name}`}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-foreground">{att.name}</span>
                <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-70 group-hover:opacity-100" aria-hidden />
              </a>
            );
          })}
        </div>
      ) : null}

      <Dialog open={openIndex !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">{current?.name ?? "Imagen adjunta"}</DialogTitle>
          {current ? (
            <img
              src={current.url}
              alt={current.name}
              className="max-h-[80vh] w-full rounded-md object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
