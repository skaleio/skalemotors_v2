import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

const HESSEN_STOCK = "HESSENMOTORS";
const MIAMI_STOCK = "MIAMIMOTORS";

/** Una venta para listado en modal */
export interface SaleListItem {
  id: string;
  sale_date: string;
  label: string;
  margin: number;
  sale_price: number;
}

/** Vehículo comprado (no consignado) para listado */
export interface VehiclePurchasedItem {
  id: string;
  make: string;
  model: string;
  year: number;
  status: string;
}

export interface FundManagementHessenBlock {
  /** Ventas Hessen: suma de ganancias y unidades */
  hessenSalesUnits: number;
  hessenSalesProfit: number;
  hessenSalesList: SaleListItem[];
  /** Ventas Miami: unidades y participación (margin que recibe Hessen) */
  miamiSalesUnits: number;
  miamiParticipation: number;
  miamiSalesList: SaleListItem[];
  /** Autos comprados (no consignados) */
  vehiclesPurchasedCount: number;
  vehiclesPurchasedList: VehiclePurchasedItem[];
  /** Consignados: listado y cantidad */
  consignadosCount: number;
  consignadosList: { id: string; label: string; status: string }[];
  /** No vendidos: stock disponible hoy */
  stockAvailableCount: number;
  stockAvailableList: { id: string; make: string; model: string; year: number }[];
}

export interface FundManagementMoneyBlock {
  /** Facturaciones: ingreso total bruto (suma sale_price) */
  facturaciones: number;
  /** Ganancias reales: lo que ya entró a caja (margin + ingresos realizados) */
  gananciasReales: number;
  /** Ganancias pendientes: lo que falta por cobrar */
  gananciasPendientes: number;
  /** Ganancias por crédito: margen de ventas con financiamiento */
  gananciasPorCredito: number;
  /** Costo preparación/limpieza: gasto acumulado por tipo */
  costoPreparacionLimpieza: number;
  /** Total invertido por Jota, Mike y Ronald (suma de gastos con esos inversores) */
  invertidoJotaMikeRonald: number;
  /** Ranking marcas más rentables por modelo */
  rankingMarcas: { make: string; model: string; units: number; margin: number }[];
}

export interface FundManagementPerformanceBlock {
  /** Cantidad de autos vendidos */
  totalVendidos: number;
  /** Autos más vendidos (modelos estrella) */
  topModelos: { make: string; model: string; count: number }[];
  /** Lead time: días promedio en stock hasta la venta */
  leadTimeDias: number | null;
  /** Origen de los leads (vendidos) */
  origenLeads: { source: string; count: number }[];
  /** Tasa conversión: crédito vs contado */
  conversionCredito: number;
  conversionContado: number;
  totalConCredito: number;
  totalContado: number;
  /** Tasa retorno / referidos / fidelizados (leads referido que compraron) */
  referidosVendidos: number;
  referidosTotal: number;
  tasaRetornoPercent: number;
}

/** Serie por día: fecha YYYY-MM-DD, cantidad y opcional facturación */
export interface SeriePorDia {
  date: string;
  label: string;
  consignaciones: number;
  ventas: number;
  facturacion: number;
}

/** Serie por mes: mes en formato YYYY-MM, etiqueta, cantidades y facturación */
export interface SeriePorMes {
  monthKey: string;
  monthLabel: string;
  consignaciones: number;
  ventas: number;
  facturacion: number;
}

export interface FundManagementCharts {
  consignacionesHoy: number;
  ventasHoy: number;
  facturacionHoy: number;
  porDia: SeriePorDia[];
  porMes: SeriePorMes[];
}

export interface FundManagementData {
  hessen: FundManagementHessenBlock;
  money: FundManagementMoneyBlock;
  performance: FundManagementPerformanceBlock;
  charts: FundManagementCharts;
}

const EMPTY_FUND_DATA: FundManagementData = {
  hessen: {
    hessenSalesUnits: 0,
    hessenSalesProfit: 0,
    hessenSalesList: [],
    miamiSalesUnits: 0,
    miamiParticipation: 0,
    miamiSalesList: [],
    vehiclesPurchasedCount: 0,
    vehiclesPurchasedList: [],
    consignadosCount: 0,
    consignadosList: [],
    stockAvailableCount: 0,
    stockAvailableList: [],
  },
  money: {
    facturaciones: 0,
    gananciasReales: 0,
    gananciasPendientes: 0,
    gananciasPorCredito: 0,
    costoPreparacionLimpieza: 0,
    invertidoJotaMikeRonald: 0,
    rankingMarcas: [],
  },
  performance: {
    totalVendidos: 0,
    topModelos: [],
    leadTimeDias: null,
    origenLeads: [],
    conversionCredito: 0,
    conversionContado: 0,
    totalConCredito: 0,
    totalContado: 0,
    referidosVendidos: 0,
    referidosTotal: 0,
    tasaRetornoPercent: 0,
  },
  charts: {
    consignacionesHoy: 0,
    ventasHoy: 0,
    facturacionHoy: 0,
    porDia: [],
    porMes: [],
  },
};

export function useFundManagement(branchId: string | null) {
  return useQuery({
    queryKey: ["fund-management", branchId],
    queryFn: async (): Promise<FundManagementData> => {
      try {
      const branchFilter = branchId ? { branch_id: branchId } : {};

      // Sales completadas (todas para métricas; filtro branch opcional)
      let salesQuery = supabase
        .from("sales")
        .select(
          `
          id, sale_price, margin, sale_date, payment_status, payment_method, stock_origin, vehicle_id,
          vehicle:vehicles(id, make, model, year, category, arrival_date, created_at)
        `
        )
        .eq("status", "completada")
        .order("sale_date", { ascending: false });

      if (branchId) {
        salesQuery = salesQuery.eq("branch_id", branchId);
      }
      const { data: salesData } = await salesQuery;
      const sales = salesData ?? [];

      // Ventas Hessen: stock_origin = HESSENMOTORS o null/otros (consideramos Hessen por defecto)
      const hessenSales = sales.filter(
        (s: { stock_origin?: string | null }) =>
          !s.stock_origin || s.stock_origin.toUpperCase() === HESSEN_STOCK
      );
      const miamiSales = sales.filter(
        (s: { stock_origin?: string | null }) =>
          (s.stock_origin || "").toUpperCase() === MIAMI_STOCK
      );

      const hessenSalesUnits = hessenSales.length;
      const hessenSalesProfit = hessenSales.reduce(
        (sum: number, s: { margin?: number | null }) => sum + Number(s.margin ?? 0),
        0
      );
      const miamiSalesUnits = miamiSales.length;
      const miamiParticipation = miamiSales.reduce(
        (sum: number, s: { margin?: number | null }) => sum + Number(s.margin ?? 0),
        0
      );

      // Vehículos: comprados vs consignados, stock disponible
      let vehiclesQuery = supabase
        .from("vehicles")
        .select("id, make, model, year, category, status, arrival_date, created_at");
      if (branchId) {
        vehiclesQuery = vehiclesQuery.eq("branch_id", branchId);
      }
      const { data: vehiclesData } = await vehiclesQuery;
      const vehicles = vehiclesData ?? [];

      const vehiclesPurchased = vehicles.filter(
        (v: { category?: string }) => (v.category || "").toLowerCase() !== "consignado"
      );
      const vehiclesPurchasedCount = vehiclesPurchased.length;
      const vehiclesPurchasedList: { id: string; make: string; model: string; year: number; status: string }[] =
        vehiclesPurchased.map((v: { id: string; make?: string; model?: string; year?: number; status?: string }) => ({
          id: v.id,
          make: v.make || "",
          model: v.model || "",
          year: v.year || 0,
          status: v.status || "",
        }));
      const stockAvailable = vehicles.filter(
        (v: { status?: string }) =>
          v.status === "disponible" || v.status === "reservado"
      );
      const stockAvailableCount = stockAvailable.length;
      const stockAvailableList = stockAvailable.slice(0, 50).map((v: { id: string; make: string; model: string; year: number }) => ({
        id: v.id,
        make: v.make || "",
        model: v.model || "",
        year: v.year || 0,
      }));

      // IDs de vehículos vendidos (ventas completadas) para marcar consignados como "Vendido"
      const soldVehicleIds = new Set(
        (sales as { vehicle_id?: string | null }[]).map((s) => s.vehicle_id).filter(Boolean) as string[]
      );

      // Consignaciones (con vehicle_id y created_at para series por día/mes)
      let consignQuery = supabase
        .from("consignaciones")
        .select("id, vehicle_id, vehicle_make, vehicle_model, vehicle_year, status, label, created_at");
      if (branchId) {
        consignQuery = consignQuery.eq("branch_id", branchId);
      }
      const { data: consignData } = await consignQuery;
      const consignaciones = consignData ?? [];
      const consignadosActive = consignaciones.filter(
        (c: { status?: string }) =>
          c.status !== "vendido" && c.status !== "devuelto"
      );
      const consignadosList = consignadosActive.map(
        (c: {
          id: string;
          vehicle_id?: string | null;
          vehicle_make?: string | null;
          vehicle_model?: string | null;
          vehicle_year?: number | null;
          status?: string;
          label?: string | null;
        }) => {
          const wasSold = Boolean(c.vehicle_id && soldVehicleIds.has(c.vehicle_id));
          return {
            id: c.id,
            label: [c.vehicle_make, c.vehicle_model, c.vehicle_year].filter(Boolean).join(" ") || c.label || "Consignación",
            status: wasSold ? "vendido" : (c.status || ""),
          };
        }
      );

      const toSaleListItem = (s: {
        id: string;
        sale_date?: string;
        vehicle_description?: string | null;
        vehicle?: { make?: string; model?: string; year?: number } | null;
        margin?: number | null;
        sale_price?: number;
      }) => {
        const label =
          (s.vehicle_description || "").trim() ||
          (s.vehicle ? `${String(s.vehicle.make || "").trim()} ${String(s.vehicle.model || "").trim()} ${String(s.vehicle.year || "")}`.trim() : "") ||
          "Venta";
        return {
          id: s.id,
          sale_date: (s.sale_date || "").slice(0, 10),
          label: (label && label.trim()) || "Sin descripción",
          margin: Number(s.margin ?? 0),
          sale_price: Number(s.sale_price ?? 0),
        };
      };
      const hessenSalesList: { id: string; sale_date: string; label: string; margin: number; sale_price: number }[] = (hessenSales || []).map((s: any) => toSaleListItem(s)).sort((a, b) => (b.sale_date || "").localeCompare(a.sale_date || ""));
      const miamiSalesList: { id: string; sale_date: string; label: string; margin: number; sale_price: number }[] = (miamiSales || []).map((s: any) => toSaleListItem(s)).sort((a, b) => (b.sale_date || "").localeCompare(a.sale_date || ""));

      // Ingresos empresa (realizados vs pendientes)
      let ingresosQuery = supabase
        .from("ingresos_empresa")
        .select("id, amount, payment_status");
      if (branchId) {
        ingresosQuery = ingresosQuery.eq("branch_id", branchId);
      }
      const { data: ingresosData } = await ingresosQuery;
      const ingresos = ingresosData ?? [];
      const ingresosRealizados = ingresos.filter(
        (i: { payment_status?: string }) => (i.payment_status || "realizado") === "realizado"
      );
      const ingresosPendientes = ingresos.filter(
        (i: { payment_status?: string }) => (i.payment_status || "") === "pendiente"
      );

      const facturaciones = sales.reduce(
        (sum: number, s: { sale_price?: number }) => sum + Number(s.sale_price ?? 0),
        0
      );
      const marginRealizado = sales
        .filter((s: { payment_status?: string | null }) => s.payment_status === "realizado")
        .reduce((sum: number, s: { margin?: number | null }) => sum + Number(s.margin ?? 0), 0);
      const gananciasReales =
        marginRealizado +
        ingresosRealizados.reduce((sum: number, i: { amount?: number }) => sum + Number(i.amount ?? 0), 0);
      const marginPendiente = sales
        .filter((s: { payment_status?: string | null }) => s.payment_status !== "realizado")
        .reduce((sum: number, s: { margin?: number | null }) => sum + Number(s.margin ?? 0), 0);
      const gananciasPendientes =
        marginPendiente +
        ingresosPendientes.reduce((sum: number, i: { amount?: number }) => sum + Number(i.amount ?? 0), 0);
      const gananciasPorCredito = sales
        .filter((s: { payment_method?: string | null }) => {
          const pm = (s.payment_method || "").toLowerCase();
          return pm.includes("credito") || pm.includes("crédito") || pm.includes("financiamiento") || pm.includes("financiado");
        })
        .reduce((sum: number, s: { margin?: number | null }) => sum + Number(s.margin ?? 0), 0);

      // Gastos: preparación/limpieza e invertido por Jota, Mike, Ronald
      const INVERSORES_INVERTIDO = ["Jota", "Mike", "Ronald"] as const;
      let gastosQuery = supabase
        .from("gastos_empresa")
        .select("id, amount, expense_type, inversor_name, inversor:users!gastos_empresa_inversor_id_fkey(id, full_name)");
      if (branchId) {
        gastosQuery = gastosQuery.eq("branch_id", branchId);
      }
      const { data: gastosData } = await gastosQuery;
      const gastos = gastosData ?? [];
      const costoPreparacionLimpieza = gastos
        .filter((g: { expense_type?: string }) => {
          const t = (g.expense_type || "").toLowerCase();
          return t.includes("preparacion") || t.includes("preparación") || t.includes("limpieza");
        })
        .reduce((sum: number, g: { amount?: number }) => sum + Number(g.amount ?? 0), 0);
      const displayInversor = (g: { inversor?: { full_name?: string | null } | null; inversor_name?: string | null }) =>
        g.inversor?.full_name ?? g.inversor_name ?? "";
      const invertidoJotaMikeRonald = gastos
        .filter((g: { amount?: number }) => {
          const name = displayInversor(g);
          return INVERSORES_INVERTIDO.some((n) => name === n);
        })
        .reduce((sum: number, g: { amount?: number }) => sum + Number(g.amount ?? 0), 0);

      // Ranking marcas por margen (ventas con vehicle)
      const makeModelMap = new Map<
        string,
        { units: number; margin: number }
      >();
      sales.forEach((s: { vehicle?: { make?: string; model?: string } | null; margin?: number | null }) => {
        const v = s.vehicle;
        const key = v ? `${v.make || ""}|${v.model || ""}` : "Sin vehículo";
        const prev = makeModelMap.get(key) ?? { units: 0, margin: 0 };
        makeModelMap.set(key, {
          units: prev.units + 1,
          margin: prev.margin + Number(s.margin ?? 0),
        });
      });
      const rankingMarcas = Array.from(makeModelMap.entries())
        .map(([key, val]) => {
          const [make, model] = key.split("|");
          return { make: make || "—", model: model || "—", units: val.units, margin: val.margin };
        })
        .sort((a, b) => b.margin - a.margin)
        .slice(0, 10);

      // Rendimiento: total vendidos, top modelos, lead time
      const totalVendidos = sales.length;
      const modelCountMap = new Map<string, number>();
      sales.forEach((s: { vehicle?: { make?: string; model?: string } | null }) => {
        const v = s.vehicle;
        const key = v ? `${v.make || ""} ${v.model || ""}` : "Sin dato";
        modelCountMap.set(key, (modelCountMap.get(key) ?? 0) + 1);
      });
      const topModelos = Array.from(modelCountMap.entries())
        .map(([label, count]) => {
          const parts = label.split(" ");
          const make = parts[0] || "—";
          const model = parts.slice(1).join(" ") || "—";
          return { make, model, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      let leadTimeSum = 0;
      let leadTimeN = 0;
      sales.forEach((s: { sale_date?: string; vehicle?: { arrival_date?: string | null; created_at?: string } | null }) => {
        const v = s.vehicle;
        const saleDate = s.sale_date;
        if (!saleDate || !v) return;
        const ref = v.arrival_date || (v as { created_at?: string }).created_at;
        if (!ref) return;
        const d1 = new Date(ref);
        const d2 = new Date(saleDate);
        const days = Math.round((d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000));
        leadTimeSum += days;
        leadTimeN += 1;
      });
      const leadTimeDias = leadTimeN > 0 ? Math.round(leadTimeSum / leadTimeN) : null;

      // Leads de ventas (origen)
      const leadIds = [...new Set((sales as { lead_id?: string | null }[]).map((s) => s.lead_id).filter(Boolean))] as string[];
      let origenLeads: { source: string; count: number }[] = [];
      if (leadIds.length > 0) {
        const { data: leadsData } = await supabase
          .from("leads")
          .select("id, source")
          .in("id", leadIds);
        const leads = leadsData ?? [];
        const sourceMap = new Map<string, number>();
        leads.forEach((l: { source?: string }) => {
          const src = l.source || "otro";
          sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
        });
        origenLeads = Array.from(sourceMap.entries()).map(([source, count]) => ({
          source: source === "referido" ? "Referido" : source === "walk_in" ? "Walk-in" : source === "redes_sociales" ? "Redes sociales" : source === "telefono" ? "Teléfono" : source,
          count,
        }));
      }

      // Conversión crédito vs contado (por venta)
      const conCredito = sales.filter((s: { payment_method?: string | null }) => {
        const pm = (s.payment_method || "").toLowerCase();
        return pm.includes("credito") || pm.includes("crédito") || pm.includes("financiamiento") || pm.includes("financiado");
      });
      const totalConCredito = conCredito.length;
      const totalContado = totalVendidos - totalConCredito;
      const conversionCredito = totalVendidos > 0 ? (totalConCredito / totalVendidos) * 100 : 0;
      const conversionContado = totalVendidos > 0 ? (totalContado / totalVendidos) * 100 : 0;

      // Referidos vendidos
      const { data: referidosData } = await supabase
        .from("leads")
        .select("id")
        .eq("source", "referido")
        .eq("status", "vendido");
      const referidosVendidos = referidosData?.length ?? 0;
      const { count: referidosTotalCount } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("source", "referido");
      const referidosTotal = referidosTotalCount ?? 0;
      const tasaRetornoPercent = referidosTotal > 0 ? (referidosVendidos / referidosTotal) * 100 : 0;

      // Consignaciones y ventas diarias / por mes (gráfico)
      const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);

      const consignacionesHoy = consignaciones.filter((c: { created_at?: string }) => {
        const d = (c.created_at || "").slice(0, 10);
        return d === todayStr;
      }).length;
      const ventasHoyList = sales.filter((s: { sale_date?: string }) => (s.sale_date || "").slice(0, 10) === todayStr);
      const ventasHoy = ventasHoyList.length;
      const facturacionHoy = ventasHoyList.reduce((sum: number, s: { sale_price?: number }) => sum + Number(s.sale_price ?? 0), 0);

      // Últimos 90 días: una fila por día
      const porDiaMap = new Map<string, { consignaciones: number; ventas: number; facturacion: number }>();
      for (let i = 89; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        porDiaMap.set(key, { consignaciones: 0, ventas: 0, facturacion: 0 });
      }
      consignaciones.forEach((c: { created_at?: string }) => {
        const key = (c.created_at || "").slice(0, 10);
        if (porDiaMap.has(key)) {
          const row = porDiaMap.get(key)!;
          row.consignaciones += 1;
        }
      });
      sales.forEach((s: { sale_date?: string; sale_price?: number }) => {
        const key = (s.sale_date || "").slice(0, 10);
        if (porDiaMap.has(key)) {
          const row = porDiaMap.get(key)!;
          row.ventas += 1;
          row.facturacion += Number(s.sale_price ?? 0);
        }
      });
      const porDia: SeriePorDia[] = Array.from(porDiaMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, val]) => ({
          date,
          label: new Date(date + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short" }),
          consignaciones: val.consignaciones,
          ventas: val.ventas,
          facturacion: val.facturacion,
        }));

      // Últimos 12 meses: una fila por mes
      const porMesMap = new Map<string, { consignaciones: number; ventas: number; facturacion: number }>();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        porMesMap.set(key, { consignaciones: 0, ventas: 0, facturacion: 0 });
      }
      consignaciones.forEach((c: { created_at?: string }) => {
        const dateStr = (c.created_at || "").slice(0, 10);
        if (!dateStr) return;
        const [y, m] = dateStr.split("-");
        const key = `${y}-${m}`;
        if (porMesMap.has(key)) {
          const row = porMesMap.get(key)!;
          row.consignaciones += 1;
        }
      });
      sales.forEach((s: { sale_date?: string; sale_price?: number }) => {
        const dateStr = (s.sale_date || "").slice(0, 10);
        if (!dateStr) return;
        const [y, m] = dateStr.split("-");
        const key = `${y}-${m}`;
        if (porMesMap.has(key)) {
          const row = porMesMap.get(key)!;
          row.ventas += 1;
          row.facturacion += Number(s.sale_price ?? 0);
        }
      });
      const porMes: SeriePorMes[] = Array.from(porMesMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([monthKey, val]) => {
          const [y, mStr] = monthKey.split("-");
          const m = parseInt(mStr, 10) - 1; // 01-12 -> 0-11 para MONTH_NAMES
          return {
            monthKey,
            monthLabel: `${MONTH_NAMES[m]} ${y}`,
            consignaciones: val.consignaciones,
            ventas: val.ventas,
            facturacion: val.facturacion,
          };
        });

      return {
        hessen: {
          hessenSalesUnits,
          hessenSalesProfit,
          hessenSalesList: hessenSalesList ?? [],
          miamiSalesUnits,
          miamiParticipation,
          miamiSalesList: miamiSalesList ?? [],
          vehiclesPurchasedCount,
          vehiclesPurchasedList: vehiclesPurchasedList ?? [],
          consignadosCount: consignadosActive.length,
          consignadosList: consignadosList ?? [],
          stockAvailableCount,
          stockAvailableList: stockAvailableList ?? [],
        },
        money: {
          facturaciones,
          gananciasReales,
          gananciasPendientes,
          gananciasPorCredito,
          costoPreparacionLimpieza,
          invertidoJotaMikeRonald,
          rankingMarcas,
        },
        performance: {
          totalVendidos,
          topModelos,
          leadTimeDias,
          origenLeads,
          conversionCredito,
          conversionContado,
          totalConCredito,
          totalContado,
          referidosVendidos,
          referidosTotal,
          tasaRetornoPercent,
        },
        charts: {
          consignacionesHoy,
          ventasHoy,
          facturacionHoy,
          porDia: porDia ?? [],
          porMes: porMes ?? [],
        },
      };
      } catch (err) {
        console.error("[useFundManagement] Error loading data:", err);
        return EMPTY_FUND_DATA;
      }
    },
    enabled: true,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
