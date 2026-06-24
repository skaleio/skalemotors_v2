import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { LeadNoteAttachmentWithUrl } from "@/lib/leadNoteAttachments";
import { cn } from "@/lib/utils";
import { useState } from "react";

type LeadNoteAttachmentsProps = {
  attachments?: LeadNoteAttachmentWithUrl[];
  className?: string;
};

/** Miniaturas de las imágenes de una nota; al hacer click se expanden en un lightbox. */
export function LeadNoteAttachments({ attachments, className }: LeadNoteAttachmentsProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!attachments?.length) return null;

  const current = openIndex !== null ? attachments[openIndex] : null;

  return (
    <div className={cn("mt-2 flex flex-wrap gap-2", className)}>
      {attachments.map((att, i) => (
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
