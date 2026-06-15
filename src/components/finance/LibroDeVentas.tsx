import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLibroVentas } from "@/hooks/useLibroVentas";
import type { LibroVentaRow } from "@/lib/services/saleBreakdown";

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function money(n: number | null | undefined) {
  return clp.format(Number(n ?? 0));
}

function fecha(s: string | null | undefined) {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}-${m}-${y}` : s;
}

type Socio = { nombre: string; monto: number };

function socioMonto(row: LibroVentaRow, nombre: string): number {
  const list = (row.socios_montos as unknown as Socio[]) ?? [];
  return list.find((s) => s.nombre === nombre)?.monto ?? 0;
}

// Paleta: azul = se ingresa, verde = se calcula.
const HEAD_BASE =
  "sticky top-0 z-20 whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide border-b";
const HEAD_IN = `${HEAD_BASE} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`;
const HEAD_CALC = `${HEAD_BASE} bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200`;
const CELL = "whitespace-nowrap px-3 py-2 border-b border-border/60";
const NUM = `${CELL} text-right tabular-nums`;
// Sombra al borde derecho de las columnas congeladas (se ve al scrollear).
const FROZEN_SHADOW = "shadow-[6px_0_8px_-6px_rgba(0,0,0,0.25)]";

function money_(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return (
    <span className={v < 0 ? "text-red-600 dark:text-red-400" : undefined}>
      {money(v)}
    </span>
  );
}

export function LibroDeVentas() {
  const { data, isLoading, error } = useLibroVentas();

  const socioNombres = useMemo(() => {
    if (data?.settings?.socios?.length) {
      return data.settings.socios.map((s) => s.nombre);
    }
    const first = data?.rows?.[0];
    if (first) {
      return ((first.socios_montos as unknown as Socio[]) ?? []).map((s) => s.nombre);
    }
    return [];
  }, [data]);

  const totales = useMemo(() => {
    const rows = data?.rows ?? [];
    return {
      utilidadFinal: rows.reduce((s, r) => s + Number(r.utilidad_final_miami ?? 0), 0),
      gastoTotal: rows.reduce((s, r) => s + Number(r.gasto_total ?? 0), 0),
      gerencia: rows.reduce((s, r) => s + Number(r.comision_gerencia ?? 0), 0),
      precioTotal: rows.reduce((s, r) => s + Number(r.precio_total ?? 0), 0),
      socios: Object.fromEntries(
        socioNombres.map((n) => [n, rows.reduce((s, r) => s + socioMonto(r, n), 0)]),
      ) as Record<string, number>,
    };
  }, [data, socioNombres]);

  const s = data?.settings;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Libro de Ventas</CardTitle>
            <CardDescription className="mt-1">
              Cada venta con su cascada completa, calculada automáticamente.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-blue-200 dark:bg-blue-900" />
              Se ingresa
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-emerald-200 dark:bg-emerald-900" />
              Se calcula
            </span>
          </div>
        </div>
        {s && (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="font-normal">
              Comisión venta {money(s.comisionVentaDefault)}
            </Badge>
            <Badge variant="secondary" className="font-normal">
              Comisión consignador {money(s.comisionConsignadorDefault)}
            </Badge>
            <Badge variant="secondary" className="font-normal">
              Gerencia {(s.pctGerencia * 100).toFixed(0)}%
            </Badge>
            {s.socios.map((so) => (
              <Badge key={so.nombre} variant="secondary" className="font-normal">
                {so.nombre} {(so.pct * 100).toFixed(0)}%
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">Cargando libro…</p>
        ) : error ? (
          <p className="px-6 py-8 text-sm text-destructive">
            No se pudo cargar el libro de ventas.
          </p>
        ) : !data?.rows.length ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            Todavía no hay ventas con desglose en el libro.
          </p>
        ) : (
          <div className="max-h-[72vh] overflow-auto [scrollbar-width:thin]">
            <table className="w-max min-w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={`${HEAD_IN} sticky left-0 z-30 w-[44px] text-center`}>N°</th>
                  <th className={`${HEAD_IN} sticky left-[44px] z-30 text-left border-r border-border ${FROZEN_SHADOW}`}>
                    Cliente
                  </th>
                  <th className={`${HEAD_IN} text-left`}>Fecha</th>
                  <th className={`${HEAD_IN} text-left`}>Vehículo</th>
                  <th className={`${HEAD_IN} text-right`}>Precio total</th>
                  <th className={`${HEAD_IN} text-right`}>Pie</th>
                  <th className={`${HEAD_CALC} text-right`}>Saldo precio</th>
                  <th className={`${HEAD_IN} text-right`}>Precio consig.</th>
                  <th className={`${HEAD_IN} text-right`}>Primer pago</th>
                  <th className={`${HEAD_IN} text-right`}>Pago final</th>
                  <th className={`${HEAD_CALC} text-right`}>Utilidad bruta</th>
                  <th className={`${HEAD_IN} text-left`}>Vendedor</th>
                  <th className={`${HEAD_IN} text-left`}>Consignador</th>
                  <th className={`${HEAD_IN} text-right`}>Com. venta</th>
                  <th className={`${HEAD_IN} text-right`}>Com. consig.</th>
                  <th className={`${HEAD_IN} text-right`}>Gasto general</th>
                  <th className={`${HEAD_CALC} text-right`}>Gasto total</th>
                  <th className={`${HEAD_CALC} text-right`}>Util. antes ger.</th>
                  <th className={`${HEAD_CALC} text-right`}>Com. gerencia</th>
                  <th className={`${HEAD_CALC} text-right`}>Util. post ger.</th>
                  {socioNombres.map((n) => (
                    <th key={n} className={`${HEAD_CALC} text-right`}>
                      {n}
                    </th>
                  ))}
                  <th className={`${HEAD_CALC} text-right`}>Utilidad final</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="group transition-colors hover:bg-muted/40">
                    <td className={`${CELL} sticky left-0 z-10 w-[44px] bg-card text-center font-medium group-hover:bg-muted/40`}>
                      {r.numero_venta ?? ""}
                    </td>
                    <td className={`${CELL} sticky left-[44px] z-10 bg-card border-r border-border font-medium group-hover:bg-muted/40 ${FROZEN_SHADOW}`}>
                      {r.sale?.client_name ?? ""}
                    </td>
                    <td className={CELL}>{fecha(r.sale?.sale_date)}</td>
                    <td className={CELL}>{r.sale?.vehicle_description ?? ""}</td>
                    <td className={NUM}>{money_(r.precio_total)}</td>
                    <td className={NUM}>{money_(r.pie)}</td>
                    <td className={`${NUM} bg-emerald-50/40 dark:bg-emerald-950/20`}>{money_(r.saldo_precio)}</td>
                    <td className={NUM}>{money_(r.precio_consignacion)}</td>
                    <td className={NUM}>{money_(r.primer_pago)}</td>
                    <td className={NUM}>{money_(r.pago_final)}</td>
                    <td className={`${NUM} bg-emerald-50/40 dark:bg-emerald-950/20`}>{money_(r.utilidad_bruta)}</td>
                    <td className={CELL}>{r.sale?.seller_name ?? ""}</td>
                    <td className={CELL}>{r.consignador_nombre ?? ""}</td>
                    <td className={NUM}>{money_(r.comision_venta)}</td>
                    <td className={NUM}>{money_(r.comision_consignador)}</td>
                    <td className={NUM}>{money_(r.gasto_general)}</td>
                    <td className={`${NUM} bg-emerald-50/40 dark:bg-emerald-950/20`}>{money_(r.gasto_total)}</td>
                    <td className={`${NUM} bg-emerald-50/40 dark:bg-emerald-950/20`}>{money_(r.utilidad_antes_gerencia)}</td>
                    <td className={`${NUM} bg-emerald-50/40 dark:bg-emerald-950/20`}>{money_(r.comision_gerencia)}</td>
                    <td className={`${NUM} bg-emerald-50/40 dark:bg-emerald-950/20`}>{money_(r.utilidad_post_gerencia)}</td>
                    {socioNombres.map((n) => (
                      <td key={n} className={`${NUM} bg-emerald-50/40 dark:bg-emerald-950/20`}>
                        {money_(socioMonto(r, n))}
                      </td>
                    ))}
                    <td
                      className={`${NUM} bg-emerald-100/70 font-semibold dark:bg-emerald-900/40 ${
                        Number(r.utilidad_final_miami ?? 0) < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {money(r.utilidad_final_miami)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/60 font-semibold">
                  <td className="sticky left-0 z-10 w-[44px] bg-muted px-3 py-2 text-center">∑</td>
                  <td className={`sticky left-[44px] z-10 border-r border-border bg-muted px-3 py-2 ${FROZEN_SHADOW}`}>
                    {data.rows.length} ventas
                  </td>
                  <td className="px-3 py-2" colSpan={2} />
                  <td className="px-3 py-2 text-right tabular-nums">{money(totales.precioTotal)}</td>
                  <td className="px-3 py-2" colSpan={11} />
                  <td className="px-3 py-2 text-right tabular-nums">{money(totales.gastoTotal)}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right tabular-nums">{money(totales.gerencia)}</td>
                  <td className="px-3 py-2" />
                  {socioNombres.map((n) => (
                    <td key={n} className="px-3 py-2 text-right tabular-nums">
                      {money(totales.socios[n] ?? 0)}
                    </td>
                  ))}
                  <td className="bg-emerald-100/80 px-3 py-2 text-right tabular-nums text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    {money(totales.utilidadFinal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
