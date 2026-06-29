import { useEffect, useRef, useState } from "react";
import { AlertCircle, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  MAX_IMAGES_PER_POST,
  uploadZernioImage,
  ZERNIO_IMAGE_TYPES,
} from "@/lib/zernio/media";

type UploadItem = {
  id: string;
  name: string;
  previewUrl: string;
  status: "uploading" | "done" | "error";
  url?: string;
  error?: string;
};

export function ZernioImageUploader({
  disabled,
  resetSignal,
  onReadyChange,
  onBusyChange,
}: {
  disabled?: boolean;
  /** Cambiar este número limpia el uploader (p. ej. tras publicar). */
  resetSignal: number;
  onReadyChange: (urls: string[]) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const idSeq = useRef(0);
  const itemsRef = useRef<UploadItem[]>([]);
  itemsRef.current = items;

  // Notifica al padre las URLs listas y si hay subidas en curso.
  useEffect(() => {
    onReadyChange(items.filter((i) => i.status === "done" && i.url).map((i) => i.url as string));
    onBusyChange(items.some((i) => i.status === "uploading"));
  }, [items, onReadyChange, onBusyChange]);

  // Reset externo (tras publicar): limpia previews y estado.
  const firstReset = useRef(true);
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false;
      return;
    }
    itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setItems([]);
  }, [resetSignal]);

  // Revoca object URLs al desmontar.
  useEffect(() => {
    return () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
  }, []);

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const remaining = MAX_IMAGES_PER_POST - itemsRef.current.length;
    if (remaining <= 0) {
      toast.error(`Máximo ${MAX_IMAGES_PER_POST} imágenes por post.`);
      return;
    }
    const toAdd = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.warning(`Solo se agregaron ${remaining}; el máximo es ${MAX_IMAGES_PER_POST}.`);
    }

    for (const file of toAdd) {
      const id = `img-${idSeq.current++}`;
      const previewUrl = URL.createObjectURL(file);
      setItems((prev) => [
        ...prev,
        { id, name: file.name, previewUrl, status: "uploading" },
      ]);

      uploadZernioImage(file)
        .then((media) => updateItem(id, { status: "done", url: media.url }))
        .catch((e) => {
          const msg = (e as Error).message;
          updateItem(id, { status: "error", error: msg });
          toast.error(msg);
        });
    }
  };

  const removeItem = (id: string) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (item) URL.revokeObjectURL(item.previewUrl);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const atLimit = items.length >= MAX_IMAGES_PER_POST;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || atLimit}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ImagePlus className="h-4 w-4" />
          Agregar imágenes
        </button>
        <span className="text-xs text-muted-foreground">
          {items.length}/{MAX_IMAGES_PER_POST} · JPG, PNG, WebP o GIF
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ZERNIO_IMAGE_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-lg border bg-muted",
                item.status === "error" && "border-destructive",
              )}
            >
              <img src={item.previewUrl} alt={item.name} className="h-full w-full object-cover" />
              {item.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
              {item.status === "error" && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-destructive/20"
                  title={item.error}
                >
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
              )}
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground opacity-0 transition group-hover:opacity-100"
                aria-label={`Quitar ${item.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
