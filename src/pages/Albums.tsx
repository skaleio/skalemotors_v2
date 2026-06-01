import { useMemo, useState } from "react";
import { Camera, Loader2, Search, Upload, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { VehicleImage } from "@/components/VehicleImage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { isPhotographerRole } from "@/lib/appRoles";
import { vehicleService } from "@/lib/services/vehicles";
import { vehiclePhotosService } from "@/lib/services/vehiclePhotos";
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

type AlbumVehicleRow = {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  patente: string | null;
  price: number | null;
  images: unknown;
  publicado_web: boolean;
};

export default function Albums() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isPhotographer = isPhotographerRole(user?.role);
  const canManage = user?.role === "admin" || isPhotographer;

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<AlbumVehicleRow | null>(null);
  const [albumName, setAlbumName] = useState("Exterior");
  const [uploading, setUploading] = useState(false);

  const vehiclesQuery = useQuery<AlbumVehicleRow[]>({
    queryKey: ["albums-vehicles"],
    queryFn: async () => {
      const data = await vehicleService.getAll({ mode: "list" });
      return (data ?? []).map((v) => ({
        id: v.id,
        make: v.make ?? null,
        model: v.model ?? null,
        year: v.year ?? null,
        patente: (v as any).patente ?? null,
        price: v.price ?? null,
        images: v.images,
        publicado_web: (v as any).publicado_web ?? false,
      }));
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return vehiclesQuery.data ?? [];
    return (vehiclesQuery.data ?? []).filter((v) => {
      const blob = `${v.make ?? ""} ${v.model ?? ""} ${v.year ?? ""} ${v.patente ?? ""}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [q, vehiclesQuery.data]);

  const albumsQuery = useQuery({
    queryKey: ["vehicle-albums", selected?.id],
    queryFn: () => vehiclePhotosService.listAlbumsSummary(selected!.id),
    enabled: !!selected?.id,
  });

  const assetsQuery = useQuery({
    queryKey: ["vehicle-album-assets", selected?.id, albumsQuery.data?.map((a) => a.album).join("|")],
    queryFn: () => vehiclePhotosService.listByVehicle(selected!.id),
    enabled: !!selected?.id,
  });

  const setPublicadoWeb = useMutation({
    mutationFn: async (next: boolean) => {
      if (!selected) return;
      if (next) {
        const images = selected.images as string[] | null | undefined;
        const hasPhoto = Array.isArray(images) && images.length > 0;
        const hasPrice = Number(selected.price || 0) > 0;
        if (!hasPhoto) throw new Error("Para publicar, el vehículo debe tener al menos 1 foto.");
        if (!hasPrice) throw new Error("Para publicar, el vehículo debe tener un precio mayor a $0.");
      }
      await vehicleService.update(selected.id, { publicado_web: next } as any);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["albums-vehicles"] });
    },
  });

  const handleUploadFiles = async (files: FileList | null) => {
    if (!selected || !files?.length) return;
    if (!canManage) return;
    const album = albumName.trim();
    if (!album) {
      toast.error("Nombre de álbum requerido");
      return;
    }

    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop();
        const safeAlbum = album.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "album";
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

      await vehiclePhotosService.addAssets({ vehicleId: selected.id, album, urls });
      toast.success("Fotos subidas");
      await queryClient.invalidateQueries({ queryKey: ["vehicle-albums", selected.id] });
      await queryClient.invalidateQueries({ queryKey: ["vehicle-album-assets", selected.id] });
      await queryClient.invalidateQueries({ queryKey: ["albums-vehicles"] });
    } catch (e) {
      toast.error("No se pudieron subir las fotos", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
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
            Organiza fotos por vehículo (carpetas) y controla qué unidades se publican en la web.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vehículos</CardTitle>
          <CardDescription>Filtra por marca, modelo, año o patente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected?.make} {selected?.model} {selected?.year} — Álbumes
            </DialogTitle>
          </DialogHeader>

          {!selected ? null : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Publicación web</p>
                  <p className="text-xs text-muted-foreground">
                    Control manual: solo admin y fotógrafo pueden publicar/quitar.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {selected.publicado_web ? "Publicado" : "No publicado"}
                  </span>
                  <Switch
                    checked={!!selected.publicado_web}
                    disabled={setPublicadoWeb.isPending}
                    onCheckedChange={(next) => {
                      setPublicadoWeb.mutate(next, {
                        onSuccess: () => {
                          setSelected((s) => (s ? { ...s, publicado_web: next } : s));
                          toast.success(next ? "Publicado en la web" : "Quitado de la web");
                        },
                        onError: (e) =>
                          toast.error("No se pudo actualizar publicación", {
                            description: e instanceof Error ? e.message : undefined,
                          }),
                      });
                    }}
                  />
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Subir fotos a un álbum</CardTitle>
                  <CardDescription>
                    Crea álbumes por nombre (Exterior/Interior/Detalles) y sube las imágenes a la carpeta correspondiente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Álbum</Label>
                      <Input value={albumName} onChange={(e) => setAlbumName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Archivos</Label>
                      <Input
                        type="file"
                        multiple
                        accept="image/*"
                        disabled={uploading}
                        onChange={(e) => {
                          void handleUploadFiles(e.target.files);
                          e.currentTarget.value = "";
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Subiendo…" : "Las fotos quedan guardadas y sincronizadas a la vitrina (si publicas el vehículo)."}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Álbumes existentes</CardTitle>
                  <CardDescription>Portada + cantidad de fotos.</CardDescription>
                </CardHeader>
                <CardContent>
                  {albumsQuery.isLoading ? (
                    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando álbumes…
                    </div>
                  ) : albumsQuery.error ? (
                    <p className="text-sm text-destructive">No se pudieron cargar los álbumes.</p>
                  ) : (albumsQuery.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aún no hay fotos/álbumes para este vehículo.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {(albumsQuery.data ?? []).map((a) => (
                        <div key={a.album} className="rounded-lg border p-3 flex gap-3">
                          <div className="h-12 w-12 overflow-hidden rounded-md bg-muted shrink-0">
                            <VehicleImage
                              src={a.coverUrl ?? PLACEHOLDER_VEHICLE_IMAGE}
                              alt=""
                              preset="thumb-xs"
                              className="h-full w-full object-cover"
                              displayWidth={48}
                              displayHeight={48}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{a.album}</p>
                            <p className="text-xs text-muted-foreground">{a.count} foto(s)</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Fotos (todas)</CardTitle>
                  <CardDescription>
                    Puedes borrar fotos individuales o marcar una como portada (aparece primera en la web).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {assetsQuery.isLoading ? (
                    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando fotos…
                    </div>
                  ) : assetsQuery.error ? (
                    <p className="text-sm text-destructive">No se pudieron cargar las fotos.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {(assetsQuery.data ?? []).map((asset) => (
                        <div key={asset.id} className="rounded-lg border overflow-hidden">
                          <div className="aspect-square bg-muted">
                            <img src={asset.url} alt="" className="h-full w-full object-cover" />
                          </div>
                          <div className="p-2 flex items-center justify-between gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={asset.is_cover ? "default" : "outline"}
                              disabled={uploading}
                              onClick={async () => {
                                try {
                                  await vehiclePhotosService.setCover({ vehicleId: selected.id, url: asset.url });
                                  toast.success("Portada actualizada");
                                  await queryClient.invalidateQueries({ queryKey: ["vehicle-album-assets", selected.id] });
                                  await queryClient.invalidateQueries({ queryKey: ["albums-vehicles"] });
                                } catch (e) {
                                  toast.error("No se pudo marcar portada", { description: e instanceof Error ? e.message : undefined });
                                }
                              }}
                            >
                              {asset.is_cover ? "Portada" : "Hacer portada"}
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={uploading}
                              onClick={async () => {
                                try {
                                  await vehiclePhotosService.deleteAsset({ id: asset.id, vehicleId: selected.id });
                                  toast.success("Foto eliminada");
                                  await queryClient.invalidateQueries({ queryKey: ["vehicle-album-assets", selected.id] });
                                  await queryClient.invalidateQueries({ queryKey: ["vehicle-albums", selected.id] });
                                  await queryClient.invalidateQueries({ queryKey: ["albums-vehicles"] });
                                } catch (e) {
                                  toast.error("No se pudo eliminar la foto", { description: e instanceof Error ? e.message : undefined });
                                }
                              }}
                              aria-label="Eliminar foto"
                              title="Eliminar foto"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="px-2 pb-2 text-xs text-muted-foreground">
                            Álbum: {asset.album}
                          </div>
                        </div>
                      ))}
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

