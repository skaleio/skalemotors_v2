import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2, DollarSign, Activity, Cpu, Hash } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperAdminMonitorUser, useAiCostMonitor } from "@/hooks/useAiCostMonitor";

function formatUSD(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatNumber(value: number | null | undefined): string {
  return Number(value ?? 0).toLocaleString("es-CL");
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MonitorPage() {
  const { user } = useAuth();
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(todayIso());

  const allowed = isSuperAdminMonitorUser(user?.email);

  const { data, isLoading, isError, error, refetch, isFetching } = useAiCostMonitor(from, to, user?.email);

  const presets = useMemo(
    () => [
      { label: "Últimos 7 días", from: isoDaysAgo(7), to: todayIso() },
      { label: "Últimos 30 días", from: isoDaysAgo(30), to: todayIso() },
      { label: "Últimos 90 días", from: isoDaysAgo(90), to: todayIso() },
    ],
    [],
  );

  // Si el user no es super-admin, redirigir (defense-in-depth además del check en RPC).
  if (!allowed) {
    return <Navigate to="/app/settings" replace />;
  }

  const summary = data && (data as { authorized?: boolean }).authorized
    ? (data as Extract<typeof data, { authorized: true }>)
    : null;

  const totals = summary?.totals ?? null;

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/settings">
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Configuración
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Monitor de Costos AI</h1>
        <p className="text-muted-foreground">
          Uso de OpenAI/Anthropic agregado cross-tenant. Sólo visible para super-admin.
        </p>
      </div>

      {/* Rango de fechas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rango</CardTitle>
          <CardDescription>Filtrá por rango de fechas o usá un preset.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="from">Desde</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to">Hasta</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFrom(p.from);
                    setTo(p.to);
                  }}
                >
                  {p.label}
                </Button>
              ))}
              <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Actualizar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertDescription>
            Error al traer el reporte: {(error as Error)?.message ?? "desconocido"}
          </AlertDescription>
        </Alert>
      )}

      {data && !summary && (
        <Alert>
          <AlertDescription>
            Acceso denegado por la RPC: {(data as { error?: string }).error ?? "no autorizado"}.
          </AlertDescription>
        </Alert>
      )}

      {summary && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1 text-xs">
                  <DollarSign className="h-3 w-3" /> Costo total
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatUSD(totals?.cost_usd ?? 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Activity className="h-3 w-3" /> Calls
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(totals?.call_count)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Hash className="h-3 w-3" /> Tokens input
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(totals?.tokens_input)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Cpu className="h-3 w-3" /> Tokens output
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(totals?.tokens_output)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown por tenant */}
          <Card>
            <CardHeader>
              <CardTitle>Por Tenant</CardTitle>
              <CardDescription>Costos por cliente del SaaS</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.by_tenant.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin uso en este rango.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4">Tenant ID</th>
                        <th className="py-2 pr-4 text-right">Calls</th>
                        <th className="py-2 pr-4 text-right">Tokens in</th>
                        <th className="py-2 pr-4 text-right">Tokens out</th>
                        <th className="py-2 pr-4 text-right">Costo USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.by_tenant.map((row) => (
                        <tr key={row.tenant_id ?? "null"} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-mono text-xs">{row.tenant_id ?? "—"}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(row.call_count)}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(row.tokens_input)}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(row.tokens_output)}</td>
                          <td className="py-2 pr-4 text-right font-semibold">{formatUSD(row.cost_usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Breakdown por feature */}
          <Card>
            <CardHeader>
              <CardTitle>Por Feature</CardTitle>
              <CardDescription>Qué Edge Function/herramienta consume más</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.by_feature.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin uso en este rango.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4">Feature</th>
                        <th className="py-2 pr-4 text-right">Calls</th>
                        <th className="py-2 pr-4 text-right">Costo USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.by_feature.map((row) => (
                        <tr key={row.feature} className="border-b last:border-0">
                          <td className="py-2 pr-4">{row.feature}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(row.call_count)}</td>
                          <td className="py-2 pr-4 text-right font-semibold">{formatUSD(row.cost_usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Breakdown por modelo */}
          <Card>
            <CardHeader>
              <CardTitle>Por Modelo</CardTitle>
              <CardDescription>Qué modelo está siendo más usado/caro</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.by_model.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin uso en este rango.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4">Modelo</th>
                        <th className="py-2 pr-4 text-right">Calls</th>
                        <th className="py-2 pr-4 text-right">Tokens in</th>
                        <th className="py-2 pr-4 text-right">Tokens out</th>
                        <th className="py-2 pr-4 text-right">Costo USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.by_model.map((row) => (
                        <tr key={row.model} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-mono text-xs">{row.model}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(row.call_count)}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(row.tokens_input)}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(row.tokens_output)}</td>
                          <td className="py-2 pr-4 text-right font-semibold">{formatUSD(row.cost_usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Por día */}
          <Card>
            <CardHeader>
              <CardTitle>Por Día</CardTitle>
              <CardDescription>Evolución diaria del gasto</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.by_day.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin uso en este rango.</p>
              ) : (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4">Día</th>
                        <th className="py-2 pr-4 text-right">Calls</th>
                        <th className="py-2 pr-4 text-right">Costo USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.by_day.map((row) => (
                        <tr key={row.day} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-mono text-xs">{row.day}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(row.call_count)}</td>
                          <td className="py-2 pr-4 text-right font-semibold">{formatUSD(row.cost_usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
