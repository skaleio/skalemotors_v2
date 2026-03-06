import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  BookmarkPlus,
  ExternalLink,
  Search,
  Globe,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { chileautosSavedService } from "@/lib/services/chileautosSaved";
import { chileautosSearchLogService } from "@/lib/services/chileautosSearchLog";

const CHILEAUTOS_BASE = "https://www.chileautos.cl/vehiculos/";

/**
 * URL directa por marca/modelo en ChileAutos: /vehiculos/{marca}/{modelo}/
 * Es más fiable que la búsqueda por keyword — usa los filtros nativos del sitio.
 */
const AUTOS_MAS_COMERCIALES: { marca: string; modelo: string; url: string }[] = [
  { marca: "Chery",      modelo: "Tiggo 7",    url: "https://www.chileautos.cl/vehiculos/chery/tiggo-7/" },
  { marca: "Chery",      modelo: "Tiggo 8",    url: "https://www.chileautos.cl/vehiculos/chery/tiggo-8/" },
  { marca: "Chery",      modelo: "Tiggo 2",    url: "https://www.chileautos.cl/vehiculos/chery/tiggo-2/" },
  { marca: "Chevrolet",  modelo: "Groove",     url: "https://www.chileautos.cl/vehiculos/chevrolet/groove/" },
  { marca: "Haval",      modelo: "Jolion",     url: "https://www.chileautos.cl/vehiculos/haval/jolion/" },
  { marca: "Haval",      modelo: "H6",         url: "https://www.chileautos.cl/vehiculos/haval/h6/" },
  { marca: "Haval",      modelo: "H6 GT",      url: "https://www.chileautos.cl/vehiculos/haval/h6-gt/" },
  { marca: "Mazda",      modelo: "CX-5",       url: "https://www.chileautos.cl/vehiculos/mazda/cx-5/" },
  { marca: "Suzuki",     modelo: "Fronx",      url: "https://www.chileautos.cl/vehiculos/suzuki/fronx/" },
  { marca: "Hyundai",    modelo: "Tucson",     url: "https://www.chileautos.cl/vehiculos/hyundai/tucson/" },
  { marca: "Hyundai",    modelo: "Santa Fe",   url: "https://www.chileautos.cl/vehiculos/hyundai/santa-fe/" },
  { marca: "Hyundai",    modelo: "Creta",      url: "https://www.chileautos.cl/vehiculos/hyundai/creta/" },
  { marca: "Ford",       modelo: "Territory",  url: "https://www.chileautos.cl/vehiculos/ford/territory/" },
  { marca: "Kia",        modelo: "Sonet",      url: "https://www.chileautos.cl/vehiculos/kia/sonet/" },
  { marca: "Omoda",      modelo: "C5",         url: "https://www.chileautos.cl/vehiculos/omoda/c5/" },
  { marca: "Nissan",     modelo: "Qashqai",    url: "https://www.chileautos.cl/vehiculos/nissan/qashqai/" },
  { marca: "Nissan",     modelo: "X-Trail",    url: "https://www.chileautos.cl/vehiculos/nissan/x-trail/" },
  { marca: "Volkswagen", modelo: "Tiguan",     url: "https://www.chileautos.cl/vehiculos/volkswagen/tiguan/" },
  { marca: "Peugeot",    modelo: "3008",       url: "https://www.chileautos.cl/vehiculos/peugeot/3008/" },
];

/** City car y Sedán para consignación (idealmente máximo 100.000 km) */
const CITY_SEDAN: { marca: string; modelo: string; url: string }[] = [
  { marca: "Suzuki",   modelo: "Baleno",   url: "https://www.chileautos.cl/vehiculos/suzuki/baleno/" },
  { marca: "Suzuki",   modelo: "Swift",    url: "https://www.chileautos.cl/vehiculos/suzuki/swift/" },
  { marca: "Kia",      modelo: "Soluto",   url: "https://www.chileautos.cl/vehiculos/kia/soluto/" },
  { marca: "Kia",      modelo: "Rio 5",    url: "https://www.chileautos.cl/vehiculos/kia/rio/" },
  { marca: "Kia",      modelo: "Cerato",   url: "https://www.chileautos.cl/vehiculos/kia/cerato/" },
  { marca: "Hyundai",  modelo: "Accent",   url: "https://www.chileautos.cl/vehiculos/hyundai/accent/" },
  { marca: "Hyundai",  modelo: "Grand i10", url: "https://www.chileautos.cl/vehiculos/hyundai/grand-i10/" },
  { marca: "Toyota",   modelo: "Yaris",    url: "https://www.chileautos.cl/vehiculos/toyota/yaris/" },
  { marca: "Kia",      modelo: "Morning",  url: "https://www.chileautos.cl/vehiculos/kia/morning/" },
  { marca: "Nissan",   modelo: "Versa",    url: "https://www.chileautos.cl/vehiculos/nissan/versa/" },
];

/**
 * Fallback cuando no se puede armar marca/modelo: búsqueda por palabra clave.
 * ChileAutos acepta búsqueda en la barra del sitio; abrimos la lista de vehículos
 * y el usuario puede usar "Palabra clave" allí. Usamos parámetro de búsqueda simple.
 */
function buildChileAutosListUrl(keyword: string, offset: number = 0): string {
  const trimmed = keyword.trim().replace(/\s+/g, " ");
  if (!trimmed) return CHILEAUTOS_BASE;
  const params = new URLSearchParams();
  params.set("q", trimmed);
  if (offset > 0) params.set("offset", String(offset));
  return `${CHILEAUTOS_BASE}?${params.toString()}`;
}

/** Slug para URL: minúsculas, espacios a guión */
function slug(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Construye URL de ChileAutos por marca y modelo.
 * Usa la URL directa /vehiculos/marca/modelo/ (lista conocida o slug). El año y kilometraje
 * se pueden filtrar en la propia página de ChileAutos una vez abierta.
 */
function buildChileAutosUrlWithFilters(filtros: {
  marca: string;
  modelo: string;
  año?: number | null;
  kilometrajeMax?: number | null;
}): string {
  const { marca, modelo } = filtros;
  const m = marca.trim();
  const mod = modelo.trim();
  if (!m || !mod) return buildChileAutosListUrl(`${m} ${mod}`.trim(), 0);

  const exact = TODOS_MODELOS.find(
    (a) => a.marca.toLowerCase() === m.toLowerCase() && a.modelo.toLowerCase() === mod.toLowerCase()
  );
  if (exact) return exact.url;
  return `${CHILEAUTOS_BASE}${slug(m)}/${slug(mod)}/`;
}

const TODOS_MODELOS = [...AUTOS_MAS_COMERCIALES, ...CITY_SEDAN];

function normalizarParaMatch(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b(19|20)\d{2}\b/g, "")
    .trim();
}

/** Distancia de Levenshtein para tolerar un typo (ej. swfit → swift). */
function levenshtein(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const curr = [i];
    for (let j = 1; j <= m; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    prev = curr;
  }
  return prev[m];
}

/**
 * Resuelve la URL de búsqueda en ChileAutos.
 * 1) Si el texto tiene al menos "marca modelo", se usa la URL directa /vehiculos/marca/modelo/
 *    (coincidencia exacta en lista conocida o construcción por slug).
 * 2) Con un solo término se usa búsqueda por palabra clave (?q=).
 */
function resolverUrlBusqueda(texto: string): string {
  const original = texto.trim();
  const normalizado = normalizarParaMatch(original);
  if (!normalizado) return buildChileAutosListUrl(original, 0);

  const words = normalizado.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const marcaTyped = words[0];
    const modeloTyped = words.slice(1).join(" ");
    const slugModeloTyped = slug(modeloTyped);

    const exact = TODOS_MODELOS.find(
      (a) =>
        a.marca.toLowerCase() === marcaTyped &&
        a.modelo.toLowerCase().replace(/\s+/g, " ") === modeloTyped
    );
    if (exact) return exact.url;

    const withTypo = TODOS_MODELOS.find((a) => {
      if (a.marca.toLowerCase() !== marcaTyped) return false;
      const slugModelo = slug(a.modelo);
      return slugModeloTyped === slugModelo || levenshtein(slugModeloTyped, slugModelo) <= 2;
    });
    if (withTypo) return withTypo.url;

    return `${CHILEAUTOS_BASE}${slug(marcaTyped)}/${slugModeloTyped}/`;
  }

  return buildChileAutosListUrl(original, 0);
}

/** Etiqueta para métricas: "Marca Modelo" si hay match en lista, si no el texto sin año. */
function resolverLabelBusqueda(texto: string): string {
  const normalizado = normalizarParaMatch(texto);
  if (!normalizado) return texto.trim();
  const words = normalizado.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const marcaTyped = words[0];
    const modeloTyped = words.slice(1).join(" ");
    const slugModeloTyped = slug(modeloTyped);
    const exact = TODOS_MODELOS.find(
      (a) =>
        a.marca.toLowerCase() === marcaTyped &&
        a.modelo.toLowerCase().replace(/\s+/g, " ") === modeloTyped
    );
    if (exact) return `${exact.marca} ${exact.modelo}`;
    const withTypo = TODOS_MODELOS.find((a) => {
      if (a.marca.toLowerCase() !== marcaTyped) return false;
      const slugModelo = slug(a.modelo);
      return slugModeloTyped === slugModelo || levenshtein(slugModeloTyped, slugModelo) <= 2;
    });
    if (withTypo) return `${withTypo.marca} ${withTypo.modelo}`;
    return `${marcaTyped.charAt(0).toUpperCase() + marcaTyped.slice(1)} ${modeloTyped}`;
  }
  return texto.trim();
}

const SAVED_QUERY_KEY = ["chileautos-saved"];
const SEARCH_METRICS_KEY = ["chileautos-search-metrics"];

export default function ChileAutosScraper() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const branchId = user?.branch_id ?? null;

  const [keyword, setKeyword] = useState("");
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formMarca, setFormMarca] = useState("");
  const [formModelo, setFormModelo] = useState("");
  const [formAño, setFormAño] = useState<string>("");
  const [formKm, setFormKm] = useState<string>("");

  const { data: savedListings = [], refetch: refetchSaved } = useQuery({
    queryKey: [...SAVED_QUERY_KEY, branchId],
    queryFn: () => chileautosSavedService.getAll({ branchId }),
    enabled: true,
  });

  const { data: searchMetrics = [], refetch: refetchSearchMetrics } = useQuery({
    queryKey: [...SEARCH_METRICS_KEY, branchId],
    queryFn: () => chileautosSearchLogService.getSearchMetrics({ branchId }),
    enabled: true,
  });

  const refetchSavedAndMetrics = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: SAVED_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: SEARCH_METRICS_KEY });
    refetchSaved();
    refetchSearchMetrics();
  }, [queryClient, refetchSaved, refetchSearchMetrics]);

  const handleDeleteSaved = useCallback(
    async (id: string) => {
      try {
        await chileautosSavedService.delete(id);
        toast({ title: "Eliminado", description: "Se quitó de la lista de guardados." });
        refetchSavedAndMetrics();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al eliminar";
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    },
    [refetchSavedAndMetrics]
  );

  /** Registra la búsqueda en métricas y abre ChileAutos en otra pestaña. */
  const buscarYAbrirPestana = useCallback(async () => {
    const q = keyword.trim();
    if (!q) {
      toast({ title: "Escribe un modelo", description: "Ej: Suzuki Swift, Hyundai Tucson", variant: "destructive" });
      return;
    }
    const label = resolverLabelBusqueda(q);
    try {
      await chileautosSearchLogService.log(label, { branchId });
      queryClient.invalidateQueries({ queryKey: SEARCH_METRICS_KEY });
      refetchSearchMetrics();
    } catch {
      // no bloquear si falla el log
    }
    const url = resolverUrlBusqueda(q);
    window.open(url, "_blank", "noopener,noreferrer");
  }, [keyword, branchId, queryClient, refetchSearchMetrics]);

  /** Al hacer clic en un modelo: registrar búsqueda y abrir ChileAutos. */
  const abrirModelo = useCallback(
    async (url: string, label: string) => {
      try {
        await chileautosSearchLogService.log(label, { branchId });
        queryClient.invalidateQueries({ queryKey: SEARCH_METRICS_KEY });
        refetchSearchMetrics();
      } catch {
        // no bloquear
      }
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [branchId, queryClient, refetchSearchMetrics]
  );

  /** Búsqueda con formulario (marca, modelo, año, km): construye URL con filtros y abre en nueva pestaña. */
  const buscarConFiltros = useCallback(async () => {
    const marca = formMarca.trim();
    const modelo = formModelo.trim();
    if (!marca || !modelo) {
      toast({
        title: "Marca y modelo obligatorios",
        description: "Completa al menos marca y modelo para buscar.",
        variant: "destructive",
      });
      return;
    }
    const año = formAño ? parseInt(formAño, 10) : null;
    const kilometrajeMax = formKm ? parseInt(formKm, 10) : null;
    const label = [marca, modelo, año ? String(año) : "", kilometrajeMax ? `hasta ${kilometrajeMax} km` : ""]
      .filter(Boolean)
      .join(" ");
    try {
      await chileautosSearchLogService.log(label.trim(), { branchId });
      queryClient.invalidateQueries({ queryKey: SEARCH_METRICS_KEY });
      refetchSearchMetrics();
    } catch {
      // no bloquear
    }
    const url = buildChileAutosUrlWithFilters({ marca, modelo, año, kilometrajeMax });
    window.open(url, "_blank", "noopener,noreferrer");
    setFormDialogOpen(false);
    setFormMarca("");
    setFormModelo("");
    setFormAño("");
    setFormKm("");
  }, [formMarca, formModelo, formAño, formKm, branchId, queryClient, refetchSearchMetrics]);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-8 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,197,94,0.15),transparent)]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 translate-x-1/3 translate-y-1/3 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 ring-1 ring-emerald-400/30 backdrop-blur">
              <Globe className="h-8 w-8 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Búsqueda de Autos
              </h1>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-400">
                Busca listados en ChileAutos.cl, guarda posibles consignaciones y revisa métricas de los modelos más comerciales.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modelos objetivo: SUVs más comerciales para consignación */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            SUVs más comerciales
          </h2>
          <Badge variant="secondary" className="rounded-full text-[10px] px-2">
            {AUTOS_MAS_COMERCIALES.length} modelos
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
          {AUTOS_MAS_COMERCIALES.map((auto) => {
            const label = `${auto.marca} ${auto.modelo}`;
            return (
              <button
                key={auto.url}
                type="button"
                onClick={() => abrirModelo(auto.url, label)}
                title={`${label} — Ver en ChileAutos`}
                className="group flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:shadow dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-primary/40 dark:hover:bg-primary/10"
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                  <span className="text-[10px] font-normal uppercase text-muted-foreground">{auto.marca}</span>
                  <span className="ml-1">{auto.modelo}</span>
                </span>
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      </div>

      {/* City car y Sedán para consignación */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            City car y Sedán para consignación
          </h2>
          <Badge variant="secondary" className="rounded-full text-[10px] px-2">
            {CITY_SEDAN.length} modelos
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
          {CITY_SEDAN.map((auto) => {
            const label = `${auto.marca} ${auto.modelo}`;
            return (
              <button
                key={auto.url}
                type="button"
                onClick={() => abrirModelo(auto.url, label)}
                title={`${label} — Ver en ChileAutos`}
                className="group flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:shadow dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-primary/40 dark:hover:bg-primary/10"
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                  <span className="text-[10px] font-normal uppercase text-muted-foreground">{auto.marca}</span>
                  <span className="ml-1">{auto.modelo}</span>
                </span>
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Buscar en ChileAutos: tipear y Buscar → abre en otra pestaña */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Buscar en ChileAutos</CardTitle>
              <CardDescription className="mt-0.5">
                Escribe el modelo y presiona <strong>Buscar</strong> para abrir ChileAutos en otra pestaña. Para afinar por año y kilometraje, usa <strong>Buscar con filtros</strong>.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="keyword-chileautos"
                placeholder="Ej: Omoda C5, Suzuki Fronx, Hyundai Tucson…"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarYAbrirPestana()}
                className="h-11 pl-10 rounded-xl"
              />
            </div>
            <Button onClick={buscarYAbrirPestana} className="h-11 rounded-xl px-6 shrink-0">
              <ExternalLink className="mr-2 h-4 w-4" />
              Buscar
            </Button>
            <Button variant="outline" onClick={() => setFormDialogOpen(true)} className="h-11 rounded-xl px-5 shrink-0">
              Buscar con filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buscar auto con filtros</DialogTitle>
            <DialogDescription>
              Completa marca y modelo (obligatorios). Año y kilometraje máximo son opcionales para afinar la búsqueda en ChileAutos y comparar precios.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="form-marca">Marca</Label>
              <Input
                id="form-marca"
                placeholder="Ej: Suzuki, Hyundai, Kia"
                value={formMarca}
                onChange={(e) => setFormMarca(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="form-modelo">Modelo</Label>
              <Input
                id="form-modelo"
                placeholder="Ej: Swift, Tucson, Yaris"
                value={formModelo}
                onChange={(e) => setFormModelo(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="form-año">Año</Label>
                <Input
                  id="form-año"
                  type="number"
                  min={1990}
                  max={2030}
                  placeholder="Ej: 2014"
                  value={formAño}
                  onChange={(e) => setFormAño(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="form-km">Kilometraje máx.</Label>
                <Input
                  id="form-km"
                  type="number"
                  min={0}
                  placeholder="Ej: 80000"
                  value={formKm}
                  onChange={(e) => setFormKm(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={buscarConFiltros}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Buscar en ChileAutos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Métricas por búsquedas y lista de guardados */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Métricas y guardados</CardTitle>
              <CardDescription className="mt-0.5">
                Los modelos que más buscáis = más comerciales para vosotros. Abajo, listado de vehículos guardados como posibles consignaciones.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modelos más buscados</p>
            {searchMetrics.length > 0 ? (
              <ul className="space-y-2">
                {searchMetrics.slice(0, 15).map((m) => (
                  <li key={m.search_keyword} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{m.search_keyword}</span>
                    <Badge variant="secondary" className="rounded-full">{m.count}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aún no hay búsquedas. Usa el cuadro de búsqueda o los modelos de arriba para que aparezca el recuento aquí.</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Listado guardado</p>
            {savedListings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-800/20">
                <BookmarkPlus className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                <p className="text-sm text-muted-foreground">
                  Aún no has guardado ningún auto.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Marca / Modelo</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead className="w-[80px]">Ficha</TableHead>
                      <TableHead className="w-[70px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {savedListings.map((s) => (
                      <TableRow key={s.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <TableCell className="font-medium max-w-[220px]">
                          <span className="line-clamp-2">{s.title ?? "—"}</span>
                        </TableCell>
                        <TableCell>
                          <span>{s.make ?? "—"}</span>
                          {s.model && <span className="text-muted-foreground"> / {s.model}</span>}
                        </TableCell>
                        <TableCell>{s.price_text ?? "—"}</TableCell>
                        <TableCell className="max-w-[180px]">
                          <span className="line-clamp-2 text-muted-foreground text-xs">{s.notes ?? "—"}</span>
                        </TableCell>
                        <TableCell>
                          {s.listing_url ? (
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                              <a href={s.listing_url} target="_blank" rel="noopener noreferrer" title="Ver en ChileAutos">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteSaved(s.id)}
                            title="Quitar de guardados"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
