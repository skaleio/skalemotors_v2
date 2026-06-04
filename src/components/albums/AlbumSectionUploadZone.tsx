import { useCallback, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Upload } from "lucide-react";

import { cn } from "@/lib/utils";

type AlbumSectionUploadZoneProps = {
  title: string;
  description: string;
  photoCount: number;
  disabled?: boolean;
  uploading?: boolean;
  onFiles: (files: FileList) => void | Promise<void>;
};

export function AlbumSectionUploadZone({
  title,
  description,
  photoCount,
  disabled = false,
  uploading = false,
  onFiles,
}: AlbumSectionUploadZoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const busy = disabled || uploading;

  const acceptFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length || busy) return;
      const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!images.length) return;
      const dt = new DataTransfer();
      images.forEach((f) => dt.items.add(f));
      void onFiles(dt.files);
    },
    [busy, onFiles],
  );

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {photoCount} foto{photoCount === 1 ? "" : "s"}
        </span>
      </div>

      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-disabled={busy}
        className={cn(
          "m-3 flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragOver && !busy && "border-primary bg-primary/5",
          !dragOver && !busy && "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/40",
          busy && "cursor-not-allowed opacity-60",
        )}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (busy) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!busy) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!busy) {
            e.dataTransfer.dropEffect = "copy";
            setDragOver(true);
          }
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          acceptFiles(e.dataTransfer.files);
        }}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className="h-8 w-8 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">
          {uploading ? "Subiendo…" : "Arrastra imágenes aquí"}
        </p>
        <p className="text-xs text-muted-foreground">o haz clic para elegir archivos</p>
        <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Upload className="h-3 w-3" />
          JPG, PNG, WebP
        </span>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          acceptFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
