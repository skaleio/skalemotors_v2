import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLibroVentas } from "@/hooks/useLibroVentas";
import type { LibroVentaRow } from "@/lib/services/saleBreakdown";

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const money = (n: number | null | undefined) => clp.format(Number(n ?? 0));

const SIN_SUCURSAL = "Sin sucursal";
const ALL = "__all__";

function branchName(r: LibroVentaRow): string {
  return r.sale?.branch?.name?.trim() || SIN_SUCURSAL;
}

type Socio = { nombre: string; monto: number };

function sociosDeRow(r: LibroVentaRow): Socio[] {
  return (r.socios_montos as unknown as Socio[]) ?? [];
}

// Mes actual en zona Chile (YYYY-MM).
function chileCurrentMonth(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" }).slice(0, 7);
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "total" | "net";
}) {
  const cls =
    tone === "total"
      ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
      : tone === "net"
        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
        : "";
  return (
    <Card className={cls}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function ComisionesDescuentos() {
  const { data, isLoading, error } = useLibroVentas();
  const [month, setMonth] = useState(chileCurrentMonth());
  const [sucursal, setSucursal] = useState(ALL);

  const sucursales = useMemo(() => {
    const set = new Set<string>();
    for (const r of data?.rows ?? []) set.add(branchName(r));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [data]);

  const rows = useMemo(() => {
    return (data?.rows ?? []).filter((r) => {
      const okMonth = (r.sale?.sale_date ?? "").startsWith(month);
      const okBranch = sucursal === ALL || branchName(r) === sucursal;
      return okMonth && okBranch;
    });
  }, [data, month, sucursal]);

  const agg = useMemo(() => {
    const sum = (f: (r: LibroVentaRow) => number) => rows.reduce((s, r) => s + f(r), 0);
    const comisionVenta = sum((r) => Number(r.comision_venta ?? 0));
    const comisionConsignador = sum((r) => Number(r.comision_consignador ?? 0));
    const gastoGeneral = sum((r) => Number(r.gasto_general ?? 0));
    const comisionGerencia = sum((r) => Number(r.comision_gerencia ?? 0));
    const utilidadFinalMiami = sum((r) => Number(r.utilidad_final_miami ?? 0));

    const sociosTotales = new Map<string, number>();
    for (const r of rows) {
      for (const s of sociosDeRow(r)) {
        sociosTotales.set(s.nombre, (sociosTotales.get(s.nombre) ?? 0) + Number(s.monto ?? 0));
      }
    }
    const repartoSocios = [...sociosTotales.values()].reduce((s, v) => s + v, 0);

    const porVendedor = new Map<string, number>();
    for (const r of rows) {
      const v = r.sale?.seller_name?.trim() || "Sin vendedor";
      porVendedor.set(v, (porVendedor.get(v) ?? 0) + Number(r.comision_venta ?? 0));
    }

    const totalDescontado =
      comisionVenta + comisionConsignador + gastoGeneral + comisionGerencia + repartoSocios;

    return {
      comisionVenta,
      comisionConsignador,
      gastoGeneral,
      comisionGerencia,
      repartoSocios,
      utilidadFinalMiami,
      totalDescontado,
      sociosTotales: [...sociosTotales.entries()].sort((a, b) => b[1] - a[1]),
      porVendedor: [...porVendedor.entries()].sort((a, b) => b[1] - a[1]),
      count: rows.length,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Comisiones y descuentos</h1>
        <p className="text-muted-foreground mt-2">
          Cuánto se descuenta de las ventas por comisiones, gerencia, gastos y reparto de socios.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="mes" className="text-xs">
            Mes
          </Label>
          <Input
            id="mes"
            type="month"
            className="h-9 w-44"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sucursal</Label>
          <Select value={sucursal} onValueChange={setSucursal}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las sucursales</SelectItem>
              {sucursales.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-destructive">No se pudieron cargar los datos.</p>
      ) : agg.count === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay ventas con desglose en este período.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{agg.count} ventas en el período.</p>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Comisión venta (vendedores)" value={money(agg.comisionVenta)} />
            <StatCard label="Comisión consignador" value={money(agg.comisionConsignador)} />
            <StatCard label="Gastos generales" value={money(agg.gastoGeneral)} />
            <StatCard label="Comisión gerencia" value={money(agg.comisionGerencia)} />
            <StatCard label="Reparto socios" value={money(agg.repartoSocios)} />
            <StatCard
              label="Total descontado"
              value={money(agg.totalDescontado)}
              hint="Comisiones + gerencia + gastos + socios"
              tone="total"
            />
            <StatCard
              label="Utilidad final Miami"
              value={money(agg.utilidadFinalMiami)}
              hint="Lo que queda neto"
              tone="net"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Comisiones por vendedor</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody>
                    {agg.porVendedor.map(([nombre, monto]) => (
                      <tr key={nombre} className="border-b border-border/60 last:border-0">
                        <td className="py-1.5">{nombre}</td>
                        <td className="py-1.5 text-right font-semibold tabular-nums">
                          {money(monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Reparto por socio</CardTitle>
              </CardHeader>
              <CardContent>
                {agg.sociosTotales.length ? (
                  <table className="w-full text-sm">
                    <tbody>
                      {agg.sociosTotales.map(([nombre, monto]) => (
                        <tr key={nombre} className="border-b border-border/60 last:border-0">
                          <td className="py-1.5">{nombre}</td>
                          <td className="py-1.5 text-right font-semibold tabular-nums">
                            {money(monto)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin reparto en el período.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
