import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { gastosEmpresaService } from '@/lib/services/gastosEmpresa'
import { ingresosEmpresaService } from '@/lib/services/ingresosEmpresa'
import { saleService } from '@/lib/services/sales'

type SaleListItem = {
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

export type DashboardSelectedMonth = { year: number; month: number }

interface DashboardStats {
  salesThisMonth: number
  salesRevenue: number
  salesThisMonthList: SaleListItem[]
  totalIncome: number
  totalIncomeMonth: number
  totalIncomeFromSales: number
  totalIncomeFromEmpresa: number
  selectedMonthLabel: string
  recentIngresosEmpresa: Array<{
    id: string
    amount: number
    income_date: string
    description: string | null
    etiqueta: string
    payment_status: string
  }>
  allIncomeList: Array<{
    type: 'sale' | 'other'
    id: string
    date: string
    description: string
    amount: number
  }>
  totalExpenses: number
  balance: number
  totalVehicles: number
  availableVehicles: number
  activeLeads: number
  scheduledAppointments: number
  salesByMonth: Array<{ month: string; sales: number; revenue: number }>
  vehiclesByCategory: Array<{ category: string; count: number }>
  expensesByType: Array<{ type: string; amount: number }>
  leadsByStatus: Array<{ status: string; count: number }>
  recentSales: Array<{
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
  }>
  recentGastos: Array<{
    id: string
    amount: number
    expense_date: string
    expense_type: string
    description: string | null
  }>
  totalIngresosPendientes: number
  ingresosPendientesList: Array<{
    id: string
    amount: number
    income_date: string
    description: string | null
    etiqueta: string
  }>
  totalGastosPendientesDevolucion: number
  gastosPendientesDevolucionList: Array<{
    id: string
    amount: number
    expense_date: string
    expense_type: string
    description: string | null
    inversor_name: string | null
  }>
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function pad2(n: number) { return String(n).padStart(2, '0') }

function monthRange(year: number, month0: number) {
  const m1 = month0 + 1
  const firstDayStr = `${year}-${pad2(m1)}-01`
  const lastDay = new Date(year, m1, 0).getDate()
  const lastDayStr = `${year}-${pad2(m1)}-${pad2(lastDay)}`
  return { firstDayStr, lastDayStr }
}

export function useDashboardStats(branchId?: string, selectedYearMonth?: DashboardSelectedMonth, userId?: string) {
  return useQuery({
    queryKey: ['dashboard-stats-v2', branchId ?? 'no-branch', selectedYearMonth?.year, selectedYearMonth?.month],
    queryFn: async (): Promise<DashboardStats> => {
      const now = new Date()
      const year = selectedYearMonth?.year ?? now.getFullYear()
      const month = selectedYearMonth?.month ?? now.getMonth()
      const { firstDayStr, lastDayStr } = monthRange(year, month)
      const selectedMonthLabel = `${MONTH_NAMES[month]} ${year}`

      // --- Gastos e Ingresos via servicios (mismo patrón que Finance.tsx) ---
      const m1 = month + 1
      const fromStr = `${year}-${pad2(m1)}-01`
      const lastD = new Date(year, m1, 0).getDate()
      const toStr = `${year}-${pad2(m1)}-${pad2(lastD)}`

      const [gastosData, ingresosData] = await Promise.all([
        gastosEmpresaService.getAll({ fromDate: fromStr, toDate: toStr }).catch(err => { console.warn('[Dashboard] gastos:', err); return [] as any[] }),
        ingresosEmpresaService.getAll({ fromDate: fromStr, toDate: toStr }).catch(err => { console.warn('[Dashboard] ingresos:', err); return [] as any[] }),
      ])

      // Ingresos empresa: todos los del mes (sin filtro de branch para igualar Finance)
      const ingresosEmpresaRealizados = (ingresosData as any[]).filter((i: any) => (i.payment_status ?? 'realizado') === 'realizado')
      const ingresosEmpresaSoloOtros = ingresosEmpresaRealizados.filter((i: any) => !i.sale_id)

      // Gastos empresa del mes
      const recentGastos = (gastosData as any[]).slice(0, 15).map((g: any) => ({
        id: g.id,
        amount: Number(g.amount || 0),
        expense_date: g.expense_date,
        expense_type: g.expense_type || 'otros',
        description: g.description ?? null,
      }))

      const totalExpenses = (gastosData as any[]).reduce((sum: number, g: any) => sum + Number(g.amount || 0), 0)
      const expensesByType = (gastosData as any[]).reduce(
        (acc: Array<{ type: string; amount: number }>, g: any) => {
          const type = g.expense_type || 'otros'
          const amount = Number(g.amount || 0)
          const existing = acc.find(item => item.type === type)
          if (existing) existing.amount += amount
          else acc.push({ type, amount })
          return acc
        }, []
      )

      const ingresosPendientesFiltered = (ingresosData as any[]).filter(
        (i: any) => (i.payment_status ?? 'realizado') === 'pendiente'
      )
      const totalIngresosPendientes = ingresosPendientesFiltered.reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0)
      const ingresosPendientesList = ingresosPendientesFiltered.slice(0, 20).map((i: any) => ({
        id: i.id,
        amount: Number(i.amount || 0),
        income_date: i.income_date,
        description: i.description ?? null,
        etiqueta: i.etiqueta || 'Otro',
      }))

      const isGastoInversor = (g: any) =>
        g.inversor_id != null || (g.inversor_name && String(g.inversor_name).trim() !== '')
      const gastosPendientesDevolucionFiltered = (gastosData as any[]).filter(
        (g: any) => !(g.devolucion ?? false) && isGastoInversor(g)
      )
      const totalGastosPendientesDevolucion = gastosPendientesDevolucionFiltered.reduce(
        (sum: number, g: any) => sum + Number(g.amount || 0), 0
      )
      const gastosPendientesDevolucionList = gastosPendientesDevolucionFiltered.slice(0, 15).map((g: any) => ({
        id: g.id,
        amount: Number(g.amount || 0),
        expense_date: g.expense_date,
        expense_type: g.expense_type || 'otros',
        description: g.description ?? null,
        inversor_name: g.inversor_name ?? null,
      }))

      const recentIngresosEmpresa = ingresosEmpresaSoloOtros.slice(0, 50).map((i: any) => ({
        id: i.id,
        amount: Number(i.amount || 0),
        income_date: i.income_date,
        description: i.description ?? null,
        etiqueta: i.etiqueta || 'Otro',
        payment_status: i.payment_status || 'realizado',
      }))

      // --- Queries directas a Supabase (ventas, vehículos, leads, citas) ---
      const safe = async <T,>(p: Promise<{ data: T | null; error: any }>, label: string): Promise<T | null> => {
        try {
          const { data, error } = await p
          if (error) { console.warn(`[Dashboard] ${label} error:`, error); return null }
          return data
        } catch (err) { console.warn(`[Dashboard] ${label} catch:`, err); return null }
      }

      const sixMonthsAgo = new Date(year, month - 5, 1)
      const sixMonthsStr = `${sixMonthsAgo.getFullYear()}-${pad2(sixMonthsAgo.getMonth() + 1)}-01`

      const [
        salesThisMonthRaw,
        incomeSalesMonthRaw,
        incomeSalesAllRaw,
        incomeSalesListRaw,
        vehiclesRaw,
        leadsRaw,
        appointmentsRaw,
        recentSalesRaw,
      ] = await Promise.all([
        saleService.getAll({
          dateFrom: firstDayStr,
          dateTo: lastDayStr,
        }).catch(err => { console.warn('[Dashboard] salesThisMonth:', err); return [] as any[] }),
        safe(supabase.from('sales').select('margin').eq('status', 'completada').eq('payment_status', 'realizado').gte('sale_date', firstDayStr).lte('sale_date', lastDayStr).then(r => r), 'incomeSalesMonth'),
        safe(supabase.from('sales').select('margin').eq('status', 'completada').eq('payment_status', 'realizado').then(r => r), 'incomeSalesAll'),
        saleService.getAll({
          status: 'completada',
          paymentStatus: 'realizado',
        }).catch(err => { console.warn('[Dashboard] incomeSalesList:', err); return [] as any[] }),
        safe(supabase.from('vehicles').select('id, status, category').then(r => r), 'vehicles'),
        safe(supabase.from('leads').select('status').then(r => r), 'leads'),
        safe(supabase.from('appointments').select('id').gte('scheduled_at', now.toISOString()).eq('status', 'programada').then(r => r), 'appointments'),
        saleService.getAll({
          dateFrom: firstDayStr,
          dateTo: lastDayStr,
        }).catch(err => { console.warn('[Dashboard] recentSales:', err); return [] as any[] }),
      ])

      // Ventas del mes
      const salesThisMonthData = (salesThisMonthRaw || []) as any[]
      const salesThisMonth = salesThisMonthData.length
      const salesRevenue = salesThisMonthData.reduce((sum: number, s: any) => sum + Number(s.sale_price || 0), 0)
      const salesThisMonthList: SaleListItem[] = salesThisMonthData.map((sale: any) => {
        const vehicleName = sale.vehicle_description?.trim() ||
          (sale.vehicle ? [sale.vehicle.make, sale.vehicle.model, sale.vehicle.year].filter(Boolean).join(' ').trim() : 'Vehículo') || 'Vehículo'
        return {
          id: sale.id, vehicle: vehicleName, amount: Number(sale.sale_price || 0), date: sale.sale_date,
          seller: sale.seller?.full_name || 'N/A',
          clientName: sale.client_name?.trim() || 'PENDIENTE',
          margin: Number(sale.margin || 0), status: sale.status ?? 'pendiente',
          payment_status: sale.payment_status ?? null, commission_credit_status: sale.commission_credit_status ?? null,
          stock_origin: sale.stock_origin ?? null,
        }
      })

      // Ingresos ventas
      const incomeFromSalesMonth = ((incomeSalesMonthRaw || []) as any[]).reduce((sum: number, s: any) => sum + Number(s.margin || 0), 0)
      const incomeFromSalesAllTime = ((incomeSalesAllRaw || []) as any[]).reduce((sum: number, s: any) => sum + Number(s.margin || 0), 0)
      const incomeFromSalesList = ((incomeSalesListRaw || []) as any[]).map((s: any) => {
        const desc = s.vehicle_description?.trim() ||
          (s.vehicle ? [s.vehicle.make, s.vehicle.model, s.vehicle.year].filter(Boolean).join(' ').trim() : '') || 'Venta'
        return { type: 'sale' as const, id: s.id, date: s.sale_date, description: desc || 'Venta', amount: Number(s.margin || 0) }
      })

      // Deduplicar otros ingresos vs ventas (por fecha+monto)
      const saleKeys = new Set(incomeFromSalesList.map(s => `${s.date}|${s.amount}`))
      const ingresosEmpresaSinDuplicados = ingresosEmpresaSoloOtros.filter(
        (i: any) => !saleKeys.has(`${i.income_date}|${Number(i.amount || 0)}`)
      )
      const incomeFromEmpresaMonth = ingresosEmpresaSinDuplicados.reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0)
      const incomeFromEmpresaAllTime = incomeFromEmpresaMonth // Solo tenemos data del mes; para histórico sería otra query
      const totalIncome = incomeFromSalesAllTime + incomeFromEmpresaAllTime
      const totalIncomeMonth = incomeFromSalesMonth + incomeFromEmpresaMonth

      const otherIncomeList = ingresosEmpresaSinDuplicados.slice(0, 100).map((i: any) => ({
        type: 'other' as const, id: i.id, date: i.income_date,
        description: [i.etiqueta, i.description].filter(Boolean).join(' · ') || 'Otro ingreso',
        amount: Number(i.amount || 0),
      }))
      const allIncomeList = [...incomeFromSalesList, ...otherIncomeList]
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 150)

      const balance = totalIncomeMonth - totalExpenses

      // Vehículos, leads, citas
      const vehiclesData = (vehiclesRaw || []) as any[]
      const totalVehicles = vehiclesData.length
      const availableVehicles = vehiclesData.filter((v: any) => v.status === 'disponible').length
      const vehiclesByCategory = vehiclesData.reduce((acc: Array<{ category: string; count: number }>, v: any) => {
        const existing = acc.find(item => item.category === v.category)
        if (existing) existing.count++
        else acc.push({ category: v.category, count: 1 })
        return acc
      }, [])

      const allLeadsData = (leadsRaw || []) as any[]
      const leadsByStatus = allLeadsData.reduce((acc: Array<{ status: string; count: number }>, l: any) => {
        const existing = acc.find(item => item.status === l.status)
        if (existing) existing.count++
        else acc.push({ status: l.status, count: 1 })
        return acc
      }, [])
      const inactiveStatuses = new Set(['vendido', 'perdido'])
      const activeLeads = allLeadsData.filter((l: any) => !inactiveStatuses.has(l.status)).length
      const scheduledAppointments = ((appointmentsRaw || []) as any[]).length

      // Gráfico ventas por mes (últimos 6 meses)
      const salesForChart = await saleService.getAll({
        dateFrom: sixMonthsStr,
        dateTo: lastDayStr,
      }).catch(err => { console.warn('[Dashboard] salesChart:', err); return [] as any[] })
      const monthBuckets = Array.from({ length: 6 }).map((_, idx) => {
        const d = new Date(year, month - (5 - idx), 1)
        return { key: `${d.getFullYear()}-${d.getMonth()}`, month: MONTH_SHORT[d.getMonth()], sales: 0, revenue: 0 }
      })
      const bucketMap = new Map(monthBuckets.map(b => [b.key, b]))
      for (const sale of salesForChart) {
        const sd = new Date(sale.sale_date)
        const bucket = bucketMap.get(`${sd.getFullYear()}-${sd.getMonth()}`)
        if (bucket) { bucket.sales += 1; bucket.revenue += Number(sale.sale_price || 0) }
      }

      // Ventas recientes
      const recentSalesData = ((recentSalesRaw || []) as any[]).slice(0, 5)
      const recentSales = recentSalesData.map((sale: any) => {
        const vehicleName = sale.vehicle_description?.trim() ||
          (sale.vehicle ? [sale.vehicle.make, sale.vehicle.model, sale.vehicle.year].filter(Boolean).join(' ').trim() : 'Vehículo') || 'Vehículo'
        return {
          id: sale.id, vehicle: vehicleName, amount: Number(sale.sale_price || 0), date: sale.sale_date,
          seller: sale.seller?.full_name || 'N/A',
          clientName: sale.client_name?.trim() || 'PENDIENTE',
          margin: Number(sale.margin || 0), status: sale.status ?? 'pendiente',
          payment_status: sale.payment_status ?? null, commission_credit_status: sale.commission_credit_status ?? null,
          stock_origin: sale.stock_origin ?? null,
        }
      })

      return {
        salesThisMonth, salesRevenue, salesThisMonthList,
        totalIncome, totalIncomeMonth,
        totalIncomeFromSales: incomeFromSalesAllTime,
        totalIncomeFromEmpresa: incomeFromEmpresaAllTime,
        selectedMonthLabel, recentIngresosEmpresa, allIncomeList,
        totalExpenses, balance,
        totalVehicles, availableVehicles, activeLeads, scheduledAppointments,
        salesByMonth: monthBuckets, vehiclesByCategory, expensesByType, leadsByStatus,
        recentSales, recentGastos,
        totalIngresosPendientes, ingresosPendientesList,
        totalGastosPendientesDevolucion, gastosPendientesDevolucionList,
      }
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  })
}
