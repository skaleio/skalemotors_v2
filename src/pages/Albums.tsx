import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Globe, Loader2, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AlbumPhotoThumbnailGrid } from "@/components/albums/AlbumPhotoThumbnailGrid";
import { AlbumSectionUploadZone } from "@/components/albums/AlbumSectionUploadZone";
import { VehicleImage } from "@/components/VehicleImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { isPhotographerRole } from "@/lib/appRoles";
import { vehicleService } from "@/lib/services/vehicles";
import { vehiclePhotosService } from "@/lib/services/vehiclePhotos";
import {
  VehicleWebPublishError,
  vehicleWebPublishService,
} from "@/lib/services/vehicleWebPublish";
import {
  filterAlbumVehicles,
  MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH,
  VEHICLE_STATUS_LABELS,
  vehicleHasMinimumAlbumPhotos,
  type AlbumQueueTab,
  type AlbumVehicleRow,
} from "@/lib/website/albumQueues";
import {
  ALBUM_NAME_EXTERIOR,
  ALBUM_NAME_INTERIOR,
  type AlbumPhotoViewTab,
  countAssetsByPhotoViewTab,
  filterGroupedAlbumsByPhotoViewTab,
  groupAssetsByAlbum,
} from "@/lib/website/albumDisplay";
import { albumPublishProgressLabel } from "@/lib/website/albumPublishRules";
import type { VehiclePhotoAsset } from "@/lib/services/vehiclePhotos";
import { formatCLP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { optimizeVehicleImageForUpload } from "@/lib/vehicleImageOptimize";

const PLACEHOLDER_VEHICLE_IMAGE = "/placeholder-vehicle.svg";

function firstVehicleImageUrl(images: unknown): string {
  const list = images as string[] | null | undefined;
  if (!Array.isArray(list) || list.length === 0) return PLACEHOLDER_VEHICLE_IMAGE;
  const first = list.find((item) => typeof item === "string" && item.trim());
  return typeof first === "string" ? first : PLACEHOLDER_VEHICLE_IMAGE;
}

export default function Albums() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isPhotographer = isPhotographerRole(user?.role);
  const canManage = user?.role === "admin" || isPhotographer;

  const [q, setQ] = useState("");
  const [queueTab, setQueueTab] = useState<AlbumQueueTab>("sin_fotos");
  const [selected, setSelected] = useState<AlbumVehicleRow | null>(null);
  const [photoViewTab, setPhotoViewTab] = useState<AlbumPhotoViewTab>("carroceria");
  const [uploadingAlbum, setUploadingAlbum] = useState<string | null>(null);

  const vehiclesQuery = useQuery<AlbumVehicleRow[]>({
    queryKey: ["albums-vehicles"],
    queryFn: async () => {
      const data = await vehicleService.getAll({ mode: "list" });
      const rows = data ?? [];
      const publishableByVehicle = await vehiclePhotosService.countPublishableByVehicleIds(
        rows.map((v) => v.id),
      );
      return rows.map((v) => ({
        id: v.id,
        make: v.make ?? null,
        model: v.model ?? null,
        year: v.year ?? null,
        patente: (v as any).patente ?? null,
        price: v.price ?? null,
        images: v.images,
        publishable_photo_count: publishableByVehicle[v.id] ?? 0,
        publicado_web: (v as any).publicado_web ?? false,
        status: (v as any).status ?? "disponible",
      }));
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(
    () => filterAlbumVehicles(vehiclesQuery.data ?? [], queueTab, q),
    [q, queueTab, vehiclesQuery.data],
  );

  const queueCounts = useMemo(() => {
    const rows = vehiclesQuery.data ?? [];
    return {
      sin_fotos: filterAlbumVehicles(rows, "sin_fotos", "").length,
      listos: filterAlbumVehicles(rows, "listos", "").length,
      en_web: filterAlbumVehicles(rows, "en_web", "").length,
      todos: rows.length,
    };
  }, [vehiclesQuery.data]);

  const assetsQuery = useQuery({
    queryKey: ["vehicle-album-assets", selected?.id],
    queryFn: () => vehiclePhotosService.listByVehicle(selected!.id),
    enabled: !!selected?.id,
  });

  const assetsByAlbum = useMemo(
    () => groupAssetsByAlbum(assetsQuery.data ?? []),
    [assetsQuery.data],
  );

  const photoViewCounts = useMemo(
    () => ({
      carroceria: countAssetsByPhotoViewTab(assetsQuery.data ?? [], "carroceria"),
      interior: countAssetsByPhotoViewTab(assetsQuery.data ?? [], "interior"),
      todas: (assetsQuery.data ?? []).length,
    }),
    [assetsQuery.data],
  );

  const visibleAssetsByAlbum = useMemo(
    () => filterGroupedAlbumsByPhotoViewTab(assetsByAlbum, photoViewTab),
    [assetsByAlbum, photoViewTab],
  );

  const visibleAssetsFlat = useMemo(() => {
    const out: VehiclePhotoAsset[] = [];
    for (const list of visibleAssetsByAlbum.values()) out.push(...list);
    return out;
  }, [visibleAssetsByAlbum]);

  const publishProgressPct = selected
    ? Math.min(100, (selected.publishable_photo_count / MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH) * 100)
    : 0;

  useEffect(() => {
    setPhotoViewTab("carroceria");
  }, [selected?.id]);

  const refreshSelectedVehicleRow = async (vehicleId: string) => {
    const refreshed = await vehicleService.getById(vehicleId);
    const publishable = await vehiclePhotosService.countPublishable(vehicleId);
    setSelected((s) =>
      s?.id === vehicleId
        ? {
            ...s,
            images: refreshed.images,
            price: refreshed.price ?? s.price,
            publishable_photo_count: publishable,
          }
        : s,
    );
    await queryClient.invalidateQueries({ queryKey: ["albums-vehicles"] });
  };

  const publishWeb = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      await vehicleWebPublishService.publish(selected.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["albums-vehicles"] });
      setSelected((s) => (s ? { ...s, publicado_web: true } : s));
      toast.success("Publicado en la web. Visible en tu vitrina al tener el sitio activo.");
    },
    onError: (e) =>
      toast.error("No se pudo publicar", {
        description: e instanceof VehicleWebPublishError || e instanceof Error ? e.message : undefined,
      }),
  });

  const unpublishWeb = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      await vehicleWebPublishService.unpublish(selected.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["albums-vehicles"] });
      setSelected((s) => (s ? { ...s, publicado_web: false } : s));
      toast.success("Quitado de la web");
    },
    onError: (e) =>
      toast.error("No se pudo quitar de la web", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const handleUploadFiles = async (album: string, files: FileList | null) => {
    if (!selected || !files?.length) return;
    if (!canManage) return;
    const albumTrimmed = album.trim();
    if (!albumTrimmed) {
      toast.error("Álbum inválido");
      return;
    }

    setUploadingAlbum(albumTrimmed);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop();
        const safeAlbum = albumTrimmed.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "album";
        const fileName = `${selected.id}/${safeAlbum}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const optimizedFile = await optimizeVehicleImageForUpload(file);
        const { error: uploadError } = await supabase.storage.from("vehicles").upload(fileName, optimizedFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: optimizedFile.type,
        });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("vehicles").getPublicUrl(fileName);
        urls.push(data.publicUrl);
      }

      await vehiclePhotosService.addAssets({ vehicleId: selected.id, album: albumTrimmed, urls });
      toast.success(`${urls.length} foto(s) subidas a ${albumTrimmed}`);
      await queryClient.invalidateQueries({ queryKey: ["vehicle-album-assets", selected.id] });
      await queryClient.invalidateQueries({ queryKey: ["albums-vehicles"] });
      await refreshSelectedVehicleRow(selected.id);
      setPhotoViewTab(albumTrimmed === ALBUM_NAME_INTERIOR ? "interior" : "carroceria");
    } catch (e) {
      toast.error("No se pudieron subir las fotos", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploadingAlbum(null);
    }
  };

  const uploading = uploadingAlbum !== null;

  const handleSetCover = async (url: string) => {
    if (!selected) return;
    try {
      await vehiclePhotosService.setCover({ vehicleId: selected.id, url });
      toast.success("Portada actualizada");
      await queryClient.invalidateQueries({ queryKey: ["vehicle-album-assets", selected.id] });
      await refreshSelectedVehicleRow(selected.id);
    } catch (e) {
      toast.error("No se pudo marcar portada", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!selected) return;
    try {
      await vehiclePhotosService.deleteAsset({ id: assetId, vehicleId: selected.id });
      toast.success("Foto eliminada");
      await queryClient.invalidateQueries({ queryKey: ["vehicle-album-assets", selected.id] });
      await refreshSelectedVehicleRow(selected.id);
    } catch (e) {
      toast.error("No se pudo eliminar la foto", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No tienes acceso a Álbumes.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-none space-y-6 pb-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Camera className="h-7 w-7" />
            Álbumes
          </h1>
          <p className="text-muted-foreground mt-1">
            Sube fotos por vehículo y publícalos en tu vitrina con un clic. Al vender o retirar un auto, se baja de la web automáticamente.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/website">
            <Globe className="mr-2 h-4 w-4" />
            Editar sitio web
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vehículos</CardTitle>
          <CardDescription>Filtra por marca, modelo, año o patente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={queueTab} onValueChange={(v) => setQueueTab(v as AlbumQueueTab)}>
            <TabsList className="flex h-auto w-full flex-wrap gap-1">
              <TabsTrigger value="sin_fotos">Faltan fotos ({queueCounts.sin_fotos})</TabsTrigger>
              <TabsTrigger value="listos">Listos ({queueCounts.listos})</TabsTrigger>
              <TabsTrigger value="en_web">En la web ({queueCounts.en_web})</TabsTrigger>
              <TabsTrigger value="todos">Todos ({queueCounts.todos})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Ej: Toyota, Corolla, 2022, ABCD12"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {vehiclesQuery.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando vehículos…
            </div>
          ) : vehiclesQuery.error ? (
            <p className="text-sm text-destructive">No se pudieron cargar los vehículos.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/40",
                    selected?.id === v.id && "border-primary",
                  )}
                  onClick={() => setSelected(v)}
                >
                  <div className="h-12 w-12 overflow-hidden rounded-md bg-muted shrink-0">
                    <VehicleImage
                      src={firstVehicleImageUrl(v.images)}
                      alt=""
                      preset="thumb-xs"
                      className="h-full w-full object-cover"
                      displayWidth={48}
                      displayHeight={48}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {v.make} {v.model} {v.year}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      Patente: {v.patente ?? "—"} · {formatCLP(Number(v.price || 0))}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {VEHICLE_STATUS_LABELS[v.status] ?? v.status}
                      </Badge>
                      {v.publicado_web ? (
                        <Badge className="text-[10px] px-1.5 py-0">En la web</Badge>
                      ) : null}
                      {!vehicleHasMinimumAlbumPhotos(v.publishable_photo_count) ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {albumPublishProgressLabel(v.publishable_photo_count)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-700">
                          Listo para web
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent
          className="max-w-5xl max-h-[90vh] overflow-y-auto"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {selected?.make} {selected?.model} {selected?.year} — Álbumes
            </DialogTitle>
          </DialogHeader>

          {!selected ? null : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Publicación en la vitrina</p>
                  <p className="text-xs text-muted-foreground">
                    Al publicar, el vehículo aparece en tu sitio (subdominio o dominio conectado en Mi Web).
                    Estados vendido, retirado o en reparación se quitan solos de la web.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="outline">{VEHICLE_STATUS_LABELS[selected.status]}</Badge>
                    {selected.publicado_web ? (
                      <Badge>Publicado en la web</Badge>
                    ) : (
                      <Badge variant="secondary">No publicado</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selected.publicado_web ? (
                    <Button
                      variant="outline"
                      disabled={unpublishWeb.isPending}
                      onClick={() => unpublishWeb.mutate()}
                    >
                      {unpublishWeb.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Quitar de la web
                    </Button>
                  ) : (
                    <Button
                      disabled={
                        publishWeb.isPending ||
                        !vehicleHasMinimumAlbumPhotos(selected.publishable_photo_count)
                      }
                      onClick={() => publishWeb.mutate()}
                    >
                      {publishWeb.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Globe className="mr-2 h-4 w-4" />
                      )}
                      Publicar en la web
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <AlbumSectionUploadZone
                  title="Exterior"
                  description="Carrocería, llantas y vistas externas del vehículo."
                  photoCount={photoViewCounts.carroceria}
                  disabled={!canManage}
                  uploading={uploadingAlbum === ALBUM_NAME_EXTERIOR}
                  onFiles={(files) => handleUploadFiles(ALBUM_NAME_EXTERIOR, files)}
                />
                <AlbumSectionUploadZone
                  title="Interior"
                  description="Tablero, asientos, equipamiento y detalles internos."
                  photoCount={photoViewCounts.interior}
                  disabled={!canManage}
                  uploading={uploadingAlbum === ALBUM_NAME_INTERIOR}
                  onFiles={(files) => handleUploadFiles(ALBUM_NAME_INTERIOR, files)}
                />
              </div>

              <Card>
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-base">Galería</CardTitle>
                    {selected ? (
                      <div className="flex w-full max-w-xs items-center gap-2 sm:w-auto">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              vehicleHasMinimumAlbumPhotos(selected.publishable_photo_count)
                                ? "bg-emerald-500"
                                : "bg-primary",
                            )}
                            style={{ width: `${publishProgressPct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                          {albumPublishProgressLabel(selected.publishable_photo_count)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <Tabs value={photoViewTab} onValueChange={(v) => setPhotoViewTab(v as AlbumPhotoViewTab)}>
                    <TabsList className="flex h-auto w-full flex-wrap gap-1">
                      <TabsTrigger value="carroceria" className="text-xs sm:text-sm">
                        Exterior ({photoViewCounts.carroceria})
                      </TabsTrigger>
                      <TabsTrigger value="interior" className="text-xs sm:text-sm">
                        Interior ({photoViewCounts.interior})
                      </TabsTrigger>
                      <TabsTrigger value="todas" className="text-xs sm:text-sm">
                        Todas ({photoViewCounts.todas})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <p className="text-[11px] text-muted-foreground">
                    Pasa el cursor sobre una miniatura para portada o eliminar. La portada de consignación no
                    suma al mínimo de {MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH}.
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  {assetsQuery.isLoading ? (
                    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando fotos…
                    </div>
                  ) : assetsQuery.error ? (
                    <p className="text-sm text-destructive">
                      No se pudieron cargar las fotos.
                      {assetsQuery.error instanceof Error ? ` ${assetsQuery.error.message}` : ""}
                    </p>
                  ) : assetsByAlbum.size === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Sin fotos. Usa las zonas Exterior e Interior de arriba.
                    </p>
                  ) : visibleAssetsFlat.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {photoViewTab === "interior"
                        ? "Sin fotos de interior en esta vista."
                        : photoViewTab === "carroceria"
                          ? "Sin fotos de exterior en esta vista."
                          : "Sin fotos en esta vista."}
                    </p>
                  ) : (
                    <div className="max-h-[min(22rem,45vh)] overflow-y-auto rounded-md border bg-muted/20 p-2 pr-1">
                      <AlbumPhotoThumbnailGrid
                        assets={visibleAssetsFlat}
                        showAlbumLabel={photoViewTab === "todas"}
                        disabled={uploading || !canManage}
                        onSetCover={handleSetCover}
                        onDelete={handleDeleteAsset}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

