export type RecentSaleListItem = {
  id: string
  vehicle: string
  amount: number
  date: string
  seller: string
  clientName: string
  margin: number
  status: string
  payment_status: string | null
  commission_credit_status: string | null
  stock_origin: string | null
}

type SaleRecord = {
  id: string
  sale_price?: number | null
  sale_date?: string | null
  client_name?: string | null
  vehicle_description?: string | null
  margin?: number | null
  status?: string | null
  payment_status?: string | null
  commission_credit_status?: string | null
  stock_origin?: string | null
  vehicle?: { make?: string; model?: string; year?: number | null } | null
  seller?: { full_name?: string | null } | null
}

export function saleRecordToListItem(sale: SaleRecord): RecentSaleListItem {
  const vehicleName =
    sale.vehicle_description?.trim() ||
    (sale.vehicle
      ? [sale.vehicle.make, sale.vehicle.model, sale.vehicle.year].filter(Boolean).join(" ").trim()
      : "") ||
    "Vehículo"

  return {
    id: sale.id,
    vehicle: vehicleName,
    amount: Number(sale.sale_price || 0),
    date: sale.sale_date ?? "",
    seller: sale.seller?.full_name || "N/A",
    clientName: sale.client_name?.trim() || "PENDIENTE",
    margin: Number(sale.margin || 0),
    status: sale.status ?? "pendiente",
    payment_status: sale.payment_status ?? null,
    commission_credit_status: sale.commission_credit_status ?? null,
    stock_origin: sale.stock_origin ?? null,
  }
}

/** Top N ventas del tenant ya ordenadas por sale_date desc; excluye canceladas. */
export function pickRecentTenantSales<T extends { status?: string | null; sale_date?: string | null }>(
  sales: T[],
  limit = 5,
): T[] {
  return sales
    .filter((s) => (s.status ?? "") !== "cancelada")
    .sort((a, b) => (b.sale_date ?? "").localeCompare(a.sale_date ?? ""))
    .slice(0, limit)
}
