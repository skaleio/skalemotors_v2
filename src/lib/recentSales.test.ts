import { describe, expect, it } from "vitest"
import { pickRecentTenantSales, saleRecordToListItem } from "./recentSales"

describe("pickRecentTenantSales", () => {
  it("devuelve las N más recientes excluyendo canceladas", () => {
    const sales = [
      { id: "1", sale_date: "2026-06-01", status: "completada" },
      { id: "2", sale_date: "2026-06-05", status: "cancelada" },
      { id: "3", sale_date: "2026-06-04", status: "completada" },
      { id: "4", sale_date: "2026-06-03", status: "pendiente" },
      { id: "5", sale_date: "2026-06-02", status: "completada" },
      { id: "6", sale_date: "2026-05-30", status: "completada" },
    ]

    const recent = pickRecentTenantSales(sales, 3)
    expect(recent.map((s) => s.id)).toEqual(["3", "4", "5"])
  })
})

describe("saleRecordToListItem", () => {
  it("arma nombre del vehículo desde relación si no hay description", () => {
    const item = saleRecordToListItem({
      id: "x",
      sale_price: 10000000,
      sale_date: "2026-06-05",
      vehicle: { make: "Toyota", model: "Corolla", year: 2020 },
      seller: { full_name: "Juan" },
      status: "completada",
    })
    expect(item.vehicle).toBe("Toyota Corolla 2020")
    expect(item.seller).toBe("Juan")
  })
})
