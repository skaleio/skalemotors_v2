import { useCallback, useState } from "react";
import {
  BarChart3,
  Car,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  Search,
  TrendingUp,
  Globe,
  PanelTop,
} from "lucide-react";
import * as XLSX from "xlsx";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  scrapeChileAutosMultiplePages,
  type ChileAutosListing,
} from "@/lib/services/chileautosScraper";

const PAGE_SIZES = [1, 2, 3, 5, 10] as const;

const CHILEAUTOS_BASE = "https://www.chileautos.cl/vehiculos/";

function buildChileAutosListUrl(keyword: string, offset: number = 0): string {
  const q = `(And.Servicio.chileautos._.CarAll.keyword(${keyword.trim().replace(/\s+/g, "+")}).)`;
  const params = new URLSearchParams({ q, sort: "topdeal" });
  if (offset > 0) params.set("offset", String(offset));
  return `${CHILEAUTOS_BASE}?${params.toString()}`;
}

export default function ChileAutosScraper() {
  const [keyword, setKeyword] = useState("");
  const [maxPages, setMaxPages] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState<ChileAutosListing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  const runScrape = useCallback(async () => {
    const q = keyword.trim();
    if (!q) {
      toast({
        title: "Búsqueda vacía",
        description: "Escribe una búsqueda (ej: suzuki swift)",
        variant: "destructive",
      });
      return;
    }
    setError(null);
    setLoading(true);
    setListings([]);
    try {
      const results = await scrapeChileAutosMultiplePages(q, maxPages);
      setListings(results);
      toast({
        title: "Búsqueda completada",
        description: `Se encontraron ${results.length} vehículo(s) en ChileAutos.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al conectar con el scraper.";
      setError(msg);
      toast({
        title: "Error al buscar",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [keyword, maxPages]);

  const exportToExcel = useCallback(() => {
    if (!listings.length) return;
    const rows = listings.map((l) => ({
      ID: l.id ?? "",
      Título: l.title ?? "",
      Marca: l.make ?? "",
      Modelo: l.model ?? "",
      Precio: l.price ?? l.priceText ?? "",
      Región: l.state ?? "",
      Categoría: l.vehcategory ?? "",
      Detalles: l.details.join(" | "),
      Vendedor: l.sellerType ?? "",
      Ubicación: l.sellerLocation ?? "",
      URL: l.url ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ChileAutos");
    XLSX.writeFile(wb, `chileautos_${keyword.trim().replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Exportado", description: "Archivo Excel descargado." });
  }, [listings, keyword]);

  const stats = useCallback(() => {
    const byMake = new Map<string, number>();
    listings.forEach((l) => {
      const m = l.make || "Sin marca";
      byMake.set(m, (byMake.get(m) || 0) + 1);
    });
    const topMakes = [...byMake.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return { total: listings.length, byMake: topMakes };
  }, [listings]);

  const stat = listings.length ? stats() : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-80" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
              <Globe className="h-8 w-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Scraper ChileAutos
              </h1>
              <p className="mt-1 max-w-xl text-sm text-slate-300">
                Busca listados de vehículos desde ChileAutos.cl. Usa la vista integrada (sin 403) o la descarga automática.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Vista integrada: ChileAutos dentro de SkaleMotors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PanelTop className="h-5 w-5" />
            Vista integrada ChileAutos
          </CardTitle>
          <CardDescription>
            Es tu navegador el que carga ChileAutos (sin 403 del servidor). Si aparece &quot;Verifying the device...&quot; y no avanza, usa <strong>Abrir en pestaña</strong> para ver el listado en una ventana normal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1 space-y-2">
              <Label htmlFor="keyword-iframe">Palabra clave</Label>
              <Input
                id="keyword-iframe"
                placeholder="ej: suzuki swift, audi"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const q = keyword.trim();
                    if (q) setIframeUrl(buildChileAutosListUrl(q, 0));
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="opacity-0 pointer-events-none">Acción</Label>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const q = keyword.trim();
                    if (!q) {
                      toast({ title: "Escribe una búsqueda", variant: "destructive" });
                      return;
                    }
                    setIframeUrl(buildChileAutosListUrl(q, 0));
                  }}
                >
                  <Globe className="mr-2 h-4 w-4" />
                  Ver listado
                </Button>
                {iframeUrl && (
                  <Button variant="outline" asChild>
                    <a href={iframeUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Abrir en pestaña
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 overflow-hidden min-h-[420px] flex flex-col">
            {iframeUrl ? (
              <>
                <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  <span>ChileAutos en iframe. Si se queda en &quot;Verifying the device...&quot;, haz clic en <strong>Abrir en pestaña</strong> arriba.</span>
                </div>
                <iframe
                  title="ChileAutos listado"
                  src={iframeUrl}
                  className="w-full min-h-[380px] flex-1 border-0"
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                  allow="fullscreen"
                />
              </>
            ) : (
              <div className="flex flex-1 min-h-[420px] flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                <PanelTop className="h-12 w-12 opacity-50" />
                <p>Escribe una palabra clave y haz clic en &quot;Ver listado&quot; para cargar ChileAutos aquí.</p>
                <p className="text-sm">Si aparece verificación de dispositivo y no carga, usa &quot;Abrir en pestaña&quot;.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Descarga automática (scraper) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Descarga automática (scraper)
            </CardTitle>
            <CardDescription>
              Intenta obtener los datos vía API. Puede fallar con 403 si ChileAutos bloquea el servidor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="keyword">Palabra clave (ej: suzuki swift)</Label>
                <Input
                  id="keyword"
                  placeholder="suzuki swift"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runScrape()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pages">Páginas a cargar</Label>
                <Select
                  value={String(maxPages)}
                  onValueChange={(v) => setMaxPages(Number(v))}
                >
                  <SelectTrigger id="pages">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? "página" : "páginas"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {error && (
              <div className="space-y-3">
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
                {(error.includes("403") || error.toLowerCase().includes("bloqueó")) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <p className="font-medium">Si sigue fallando (403 / WAF):</p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                      <li>Reintenta más tarde; a veces el bloqueo es temporal.</li>
                      <li>ChileAutos puede bloquear IPs de datacenters (Supabase). Una alternativa es usar un proxy o servicio de scraping (ScraperAPI, Bright Data) y llamarlos desde la Edge Function.</li>
                      <li>Para máxima compatibilidad haría falta un scraper con navegador real (Playwright) en otro servidor.</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
            <Button
              onClick={runScrape}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando…
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Buscar en ChileAutos
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {stat && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Resumen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
                <Car className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stat.total}</p>
                  <p className="text-sm text-muted-foreground">vehículos encontrados</p>
                </div>
              </div>
              {stat.byMake.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    Top marcas
                  </p>
                  <ul className="space-y-1.5">
                    {stat.byMake.map(([make, count]) => (
                      <li
                        key={make}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{make}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={exportToExcel}
                disabled={!listings.length}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar a Excel
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Results table */}
      {listings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Resultados
            </CardTitle>
            <CardDescription>
              Listado scrapeado desde ChileAutos.cl. Abre el enlace para ver la ficha completa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Marca / Modelo</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Región</TableHead>
                    <TableHead className="w-[80px]">Ficha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listings.map((l) => (
                    <TableRow key={l.id ?? l.url ?? Math.random()}>
                      <TableCell className="font-medium max-w-[280px]">
                        <span className="line-clamp-2">{l.title ?? "—"}</span>
                        {l.details.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {l.details.slice(0, 2).join(" · ")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{l.make ?? "—"}</span>
                        {l.model && (
                          <span className="text-muted-foreground"> / {l.model}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {l.priceText ?? l.price ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {l.state ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {l.url ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                          >
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver en ChileAutos"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && listings.length === 0 && keyword.trim() && !error && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              No se encontraron resultados para &quot;{keyword.trim()}&quot;.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Prueba otra búsqueda o revisa que la API esté disponible (despliegue en Vercel).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
