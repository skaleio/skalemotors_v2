import { Star, Trash2 } from "lucide-react";

import { VehicleImage } from "@/components/VehicleImage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VehiclePhotoAsset } from "@/lib/services/vehiclePhotos";
import { isConsignmentReferenceAsset } from "@/lib/website/albumPublishRules";

type AlbumPhotoThumbnailGridProps = {
  assets: VehiclePhotoAsset[];
  showAlbumLabel?: boolean;
  disabled?: boolean;
  onSetCover: (url: string) => void | Promise<void>;
  onDelete: (assetId: string) => void | Promise<void>;
};

export function AlbumPhotoThumbnailGrid({
  assets,
  showAlbumLabel = false,
  disabled = false,
  onSetCover,
  onDelete,
}: AlbumPhotoThumbnailGridProps) {
  if (!assets.length) return null;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {assets.map((asset) => {
        const isRef = isConsignmentReferenceAsset(asset);
        return (
          <div
            key={asset.id}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-md border bg-muted",
              asset.is_cover && !isRef && "ring-2 ring-primary ring-offset-1 ring-offset-background",
            )}
          >
            <VehicleImage
              src={asset.url}
              alt=""
              preset="thumb-xs"
              className="h-full w-full object-cover"
              displayWidth={64}
              displayHeight={64}
            />

            {(asset.is_cover || isRef) && (
              <div className="absolute left-1 top-1 flex max-w-[calc(100%-8px)] flex-col gap-0.5">
                {asset.is_cover ? (
                  <span className="rounded bg-primary px-1 py-0.5 text-[9px] font-medium leading-none text-primary-foreground">
                    Portada
                  </span>
                ) : null}
                {isRef ? (
                  <span className="rounded bg-secondary px-1 py-0.5 text-[9px] font-medium leading-none text-secondary-foreground">
                    Consign.
                  </span>
                ) : null}
              </div>
            )}

            {showAlbumLabel ? (
              <span className="absolute bottom-1 left-1 right-1 truncate rounded bg-background/85 px-1 py-0.5 text-center text-[9px] text-foreground">
                {asset.album}
              </span>
            ) : null}

            {!disabled ? (
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <Button
                  type="button"
                  size="icon"
                  variant={asset.is_cover ? "default" : "secondary"}
                  className="h-8 w-8 shrink-0"
                  title={asset.is_cover ? "Portada actual" : "Marcar como portada web"}
                  aria-label={asset.is_cover ? "Portada actual" : "Marcar como portada web"}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onSetCover(asset.url);
                  }}
                >
                  <Star className={cn("h-4 w-4", asset.is_cover && "fill-current")} />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8 shrink-0"
                  title="Eliminar foto"
                  aria-label="Eliminar foto"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onDelete(asset.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
