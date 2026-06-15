import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

// Cabecera azul = se ingresa; verde = se calcula.
const TH_IN = "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 whitespace-nowrap";
const TH_CALC = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 whitespace-nowrap";

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
      socios: Object.fromEntries(
        socioNombres.map((n) => [n, rows.reduce((s, r) => s + socioMonto(r, n), 0)]),
      ) as Record<string, number>,
    };
  }, [data, socioNombres]);

  const s = data?.settings;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Libro de Ventas</CardTitle>
        <CardDescription>
          Cada venta con su cascada completa. Columnas{" "}
          <span className="text-blue-600 dark:text-blue-400">azules</span> se ingresan;{" "}
          <span className="text-emerald-600 dark:text-emerald-400">verdes</span> se calculan solas.
        </CardDescription>
        {s && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Comisión venta: {money(s.comisionVentaDefault)}</span>
            <span>Comisión consignador: {money(s.comisionConsignadorDefault)}</span>
            <span>Gerencia: {(s.pctGerencia * 100).toFixed(0)}%</span>
            {s.socios.map((so) => (
              <span key={so.nombre}>
                {so.nombre}: {(so.pct * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando libro…</p>
        ) : error ? (
          <p className="text-sm text-destructive">No se pudo cargar el libro de ventas.</p>
        ) : !data?.rows.length ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay ventas con desglose en el libro.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className={TH_IN}>N°</TableHead>
                  <TableHead className={TH_IN}>Fecha</TableHead>
                  <TableHead className={TH_IN}>Cliente</TableHead>
                  <TableHead className={TH_IN}>Vehículo</TableHead>
                  <TableHead className={`${TH_IN} text-right`}>Precio total</TableHead>
                  <TableHead className={`${TH_IN} text-right`}>Pie</TableHead>
                  <TableHead className={`${TH_CALC} text-right`}>Saldo precio</TableHead>
                  <TableHead className={`${TH_IN} text-right`}>Precio consig.</TableHead>
                  <TableHead className={`${TH_IN} text-right`}>Primer pago</TableHead>
                  <TableHead className={`${TH_IN} text-right`}>Pago final</TableHead>
                  <TableHead className={`${TH_CALC} text-right`}>Utilidad bruta</TableHead>
                  <TableHead className={TH_IN}>Vendedor</TableHead>
                  <TableHead className={TH_IN}>Consignador</TableHead>
                  <TableHead className={`${TH_IN} text-right`}>Com. venta</TableHead>
                  <TableHead className={`${TH_IN} text-right`}>Com. consig.</TableHead>
                  <TableHead className={`${TH_IN} text-right`}>Gasto general</TableHead>
                  <TableHead className={`${TH_CALC} text-right`}>Gasto total</TableHead>
                  <TableHead className={`${TH_CALC} text-right`}>Util. antes ger.</TableHead>
                  <TableHead className={`${TH_CALC} text-right`}>Com. gerencia</TableHead>
                  <TableHead className={`${TH_CALC} text-right`}>Util. post ger.</TableHead>
                  {socioNombres.map((n) => (
                    <TableHead key={n} className={`${TH_CALC} text-right`}>
                      {n}
                    </TableHead>
                  ))}
                  <TableHead className={`${TH_CALC} text-right`}>Utilidad final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.numero_venta ?? ""}</TableCell>
                    <TableCell className="whitespace-nowrap">{fecha(r.sale?.sale_date)}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.sale?.client_name ?? ""}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.sale?.vehicle_description ?? ""}</TableCell>
                    <TableCell className="text-right">{money(r.precio_total)}</TableCell>
                    <TableCell className="text-right">{money(r.pie)}</TableCell>
                    <TableCell className="text-right">{money(r.saldo_precio)}</TableCell>
                    <TableCell className="text-right">{money(r.precio_consignacion)}</TableCell>
                    <TableCell className="text-right">{money(r.primer_pago)}</TableCell>
                    <TableCell className="text-right">{money(r.pago_final)}</TableCell>
                    <TableCell className="text-right">{money(r.utilidad_bruta)}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.sale?.seller_name ?? ""}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.consignador_nombre ?? ""}</TableCell>
                    <TableCell className="text-right">{money(r.comision_venta)}</TableCell>
                    <TableCell className="text-right">{money(r.comision_consignador)}</TableCell>
                    <TableCell className="text-right">{money(r.gasto_general)}</TableCell>
                    <TableCell className="text-right">{money(r.gasto_total)}</TableCell>
                    <TableCell className="text-right">{money(r.utilidad_antes_gerencia)}</TableCell>
                    <TableCell className="text-right">{money(r.comision_gerencia)}</TableCell>
                    <TableCell className="text-right">{money(r.utilidad_post_gerencia)}</TableCell>
                    {socioNombres.map((n) => (
                      <TableCell key={n} className="text-right">
                        {money(socioMonto(r, n))}
                      </TableCell>
                    ))}
                    <TableCell
                      className={`text-right font-semibold ${
                        Number(r.utilidad_final_miami ?? 0) < 0 ? "text-destructive" : "text-emerald-600"
                      }`}
                    >
                      {money(r.utilidad_final_miami)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={16} className="text-right font-medium">
                    Totales
                  </TableCell>
                  <TableCell className="text-right font-medium">{money(totales.gastoTotal)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-medium">{money(totales.gerencia)}</TableCell>
                  <TableCell />
                  {socioNombres.map((n) => (
                    <TableCell key={n} className="text-right font-medium">
                      {money(totales.socios[n] ?? 0)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-semibold text-emerald-600">
                    {money(totales.utilidadFinal)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
