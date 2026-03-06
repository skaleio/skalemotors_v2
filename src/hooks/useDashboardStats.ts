import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'

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

interface DashboardStats {
  salesThisMonth: number
  salesRevenue: number
  salesThisMonthList: SaleListItem[]
  totalIncome: number
  totalIncomeFromSales: number
  totalIncomeFromEmpresa: number
  recentIngresosEmpresa: Array<{
    id: string
    amount: number
    income_date: string
    description: string | null
    etiqueta: string
    payment_status: string
  }>
  /** Lista unificada de todos los ingresos (ventas + ingresos empresa), ordenada por fecha desc */
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
  /** Ingresos empresa con pago pendiente (no suman al balance hasta marcarlos realizados) */
  totalIngresosPendientes: number
  ingresosPendientesList: Array<{
    id: string
    amount: number
    income_date: string
    description: string | null
    etiqueta: string
  }>
  /** Gastos sin devolver (inversores, no empresa) */
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

export function useDashboardStats(branchId?: string) {
  return useQuery({
    queryKey: ['dashboard-stats', branchId],
    queryFn: async (): Promise<DashboardStats> => {
      try {
        const now = new Date()
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        const firstDayStr = firstDayOfMonth.toISOString().split('T')[0]
        const lastDayStr = lastDayOfMonth.toISOString().split('T')[0]
        const timeoutMs = 15000

        const withTimeout = async <T,>(promise: Promise<T>, label: string): Promise<T> => {
          return await Promise.race([
            promise,
            new Promise<T>((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout en ${label}`)), timeoutMs)
            ),
          ])
        }

        const safeQuery = async <T,>(promise: Promise<T>, label: string, defaultValue: T): Promise<T> => {
          try {
            return await withTimeout(promise, label)
          } catch {
            return defaultValue
          }
        }

        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
        const sixMonthsStr = sixMonthsAgo.toISOString().split('T')[0]

        let salesQ = supabase.from('sales').select('sale_price, sale_date').gte('sale_date', sixMonthsStr).eq('status', 'completada')
        if (branchId) salesQ = salesQ.eq('branch_id', branchId)

        let vehiclesQ = supabase.from('vehicles').select('id, status, category')
        if (branchId) vehiclesQ = vehiclesQ.eq('branch_id', branchId)

        let leadsQ = supabase.from('leads').select('status')
        if (branchId) leadsQ = leadsQ.eq('branch_id', branchId)

        let appointmentsQ = supabase.from('appointments').select('id').gte('scheduled_at', now.toISOString()).eq('status', 'programada')
        if (branchId) appointmentsQ = appointmentsQ.eq('branch_id', branchId)

        const [salesResult, vehiclesResult, allLeadsResult, appointmentsResult] = await Promise.all([
          safeQuery(salesQ.then(res => res), 'salesQuery', { data: null, error: null }),
          safeQuery(vehiclesQ.then(res => res), 'vehiclesQuery', { data: null, error: null }),
          safeQuery(leadsQ.then(res => res), 'allLeadsQuery', { data: null, error: null }),
          safeQuery(appointmentsQ.then(res => res), 'appointmentsQuery', { data: null, error: null }),
        ])

        const salesData = salesResult?.data || []
        const salesThisMonth = salesData.filter((s: any) => new Date(s.sale_date) >= firstDayOfMonth).length
        const salesRevenue = salesData
          .filter((s: any) => new Date(s.sale_date) >= firstDayOfMonth)
          .reduce((sum: number, s: any) => sum + Number(s.sale_price || 0), 0)

        const vehiclesData = vehiclesResult?.data || []
        const totalVehicles = vehiclesData?.length || 0
        const availableVehicles = vehiclesData?.filter((v: any) => v.status === 'disponible').length || 0

        const allLeadsData = allLeadsResult?.data || []
        const leadsByStatus = allLeadsData?.reduce((acc: Array<{ status: string; count: number }>, l) => {
          const existing = acc.find(item => item.status === l.status)
          if (existing) existing.count++
          else acc.push({ status: l.status, count: 1 })
          return acc
        }, []) || []
        const inactiveLeadStatuses = new Set(['vendido', 'perdido'])
        const activeLeads = allLeadsData.filter((l: any) => !inactiveLeadStatuses.has(l.status)).length

        const scheduledAppointments = (appointmentsResult?.data || []).length

        let salesThisMonthQuery = supabase.from('sales').select(`
          id, sale_price, sale_date, vehicle_description, client_name, margin, status,
          payment_status, commission_credit_status, stock_origin,
          vehicle:vehicles (make, model, year),
          seller:users (full_name)
        `).gte('sale_date', firstDayStr).lte('sale_date', lastDayStr).eq('status', 'completada').order('sale_date', { ascending: false })
        if (branchId) salesThisMonthQuery = salesThisMonthQuery.eq('branch_id', branchId)

        let incomeSalesMonthQ = supabase.from('sales').select('margin, sale_date, payment_status').eq('status', 'completada').eq('payment_status', 'realizado').gte('sale_date', firstDayStr).lte('sale_date', lastDayStr)
        if (branchId) incomeSalesMonthQ = incomeSalesMonthQ.eq('branch_id', branchId)

        let incomeSalesAllQ = supabase.from('sales').select('margin').eq('status', 'completada').eq('payment_status', 'realizado')
        if (branchId) incomeSalesAllQ = incomeSalesAllQ.eq('branch_id', branchId)

        let incomeSalesListQ = supabase.from('sales').select(`
          id, sale_date, margin, vehicle_description,
          vehicle:vehicles (make, model, year)
        `).eq('status', 'completada').eq('payment_status', 'realizado').order('sale_date', { ascending: false }).limit(100)
        if (branchId) incomeSalesListQ = incomeSalesListQ.eq('branch_id', branchId)

        let ingresosEmpresaQ = supabase.from('ingresos_empresa').select('id, amount, income_date, description, etiqueta, payment_status, sale_id').order('income_date', { ascending: false })
        if (branchId) ingresosEmpresaQ = ingresosEmpresaQ.eq('branch_id', branchId)

        let gastosEmpresaQ = supabase.from('gastos_empresa').select('id, amount, expense_date, expense_type, description, devolucion, inversor_id, inversor_name').order('expense_date', { ascending: false })
        if (branchId) gastosEmpresaQ = gastosEmpresaQ.eq('branch_id', branchId)

        let recentSalesQ = supabase.from('sales').select(`
          id, sale_price, sale_date, vehicle_description, client_name, margin, status,
          payment_status, commission_credit_status, stock_origin,
          vehicle:vehicles (make, model, year),
          seller:users (full_name)
        `).order('sale_date', { ascending: false }).limit(5)
        if (branchId) recentSalesQ = recentSalesQ.eq('branch_id', branchId)

        const [
          salesThisMonthRes,
          incomeSalesMonthRes,
          incomeSalesAllRes,
          incomeSalesListRes,
          ingresosEmpresaRes,
          gastosEmpresaRes,
          recentSalesRes,
        ] = await Promise.all([
          safeQuery(salesThisMonthQuery.then(res => res), 'salesThisMonthQuery', { data: null, error: null }),
          safeQuery(incomeSalesMonthQ.then(res => res), 'incomeFromSalesQueryMonth', { data: null, error: null }),
          safeQuery(incomeSalesAllQ.then(res => res), 'incomeFromSalesQueryAll', { data: null, error: null }),
          safeQuery(incomeSalesListQ.then(res => res), 'incomeSalesListQuery', { data: null, error: null }),
          safeQuery(ingresosEmpresaQ.then(res => res), 'ingresosEmpresaQuery', { data: null, error: null }),
          safeQuery(gastosEmpresaQ.then(res => res), 'gastosEmpresaQuery', { data: null, error: null }),
          safeQuery(recentSalesQ.then(res => res), 'recentSalesQuery', { data: null, error: null }),
        ])

        const salesThisMonthData = salesThisMonthRes?.data || []
        const salesThisMonthList: SaleListItem[] = salesThisMonthData.map((sale: any) => {
          const vehicleName = sale.vehicle_description?.trim() ||
            (sale.vehicle ? [sale.vehicle.make, sale.vehicle.model, sale.vehicle.year].filter(Boolean).join(' ').trim() : 'Vehículo') || 'Vehículo'
          return {
            id: sale.id,
            vehicle: vehicleName,
            amount: Number(sale.sale_price || 0),
            date: sale.sale_date,
            seller: sale.seller?.full_name || 'N/A',
            clientName: sale.client_name?.trim() || sale.lead?.full_name || 'PENDIENTE',
            margin: Number(sale.margin || 0),
            status: sale.status ?? 'pendiente',
            payment_status: sale.payment_status ?? null,
            commission_credit_status: sale.commission_credit_status ?? null,
            stock_origin: sale.stock_origin ?? null,
          }
        })

        const incomeSalesDataMonth = incomeSalesMonthRes?.data || []
        const incomeSalesDataAll = incomeSalesAllRes?.data || []
        const incomeSalesListData = incomeSalesListRes?.data || []
        const incomeFromSalesAllTime = (incomeSalesDataAll || []).reduce((sum: number, s: any) => sum + Number(s.margin || 0), 0)
        const incomeFromSalesList = (incomeSalesListData || []).map((s: any) => {
          const description = s.vehicle_description?.trim() ||
            (s.vehicle ? [s.vehicle.make, s.vehicle.model, s.vehicle.year].filter(Boolean).join(' ').trim() : '') || 'Venta'
          return {
            type: 'sale' as const,
            id: s.id,
            date: s.sale_date,
            description: description || 'Venta',
            amount: Number(s.margin || 0),
          }
        })

        const ingresosEmpresaData = ingresosEmpresaRes?.data || []

        const ingresosEmpresaRealizados = (ingresosEmpresaData || [])
          .filter((i: any) => (i.payment_status ?? 'realizado') === 'realizado')
        // Excluir ingresos ligados a una venta (sale_id) para no duplicar con "Ganancia por ventas"
        const ingresosEmpresaSoloOtros = ingresosEmpresaRealizados.filter((i: any) => !i.sale_id)
        // Segunda línea de defensa: no contar ni mostrar "otros" que coincidan con una venta (misma fecha y monto)
        const saleKeys = new Set(incomeFromSalesList.map((s) => `${s.date}|${s.amount}`))
        const ingresosEmpresaSoloOtrosSinDuplicados = ingresosEmpresaSoloOtros.filter(
          (i: any) => !saleKeys.has(`${i.income_date}|${Number(i.amount || 0)}`)
        )
        const ingresosEmpresaDelMes = ingresosEmpresaSoloOtrosSinDuplicados.filter(
          (i: any) => i.income_date >= firstDayStr && i.income_date <= lastDayStr
        )
        const recentIngresosEmpresa = ingresosEmpresaSoloOtrosSinDuplicados.slice(0, 50).map((i: any) => ({
          id: i.id,
          amount: Number(i.amount || 0),
          income_date: i.income_date,
          description: i.description ?? null,
          etiqueta: i.etiqueta || 'Otro',
          payment_status: i.payment_status || 'realizado',
        }))

        const otherIncomeList = ingresosEmpresaSoloOtrosSinDuplicados.slice(0, 100).map((i: any) => ({
          type: 'other' as const,
          id: i.id,
          date: i.income_date,
          description: [i.etiqueta, i.description].filter(Boolean).join(' · ') || 'Otro ingreso',
          amount: Number(i.amount || 0),
        }))
        const allIncomeList = [...incomeFromSalesList, ...otherIncomeList]
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          .slice(0, 150)

        const gastosEmpresaData = gastosEmpresaRes?.data || []

        const recentGastos = (gastosEmpresaData || []).slice(0, 15).map((g: any) => ({
          id: g.id,
          amount: Number(g.amount || 0),
          expense_date: g.expense_date,
          expense_type: g.expense_type || 'otros',
          description: g.description ?? null,
        }))

        const ingresosPendientesFiltered = (ingresosEmpresaData || []).filter(
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
        const gastosPendientesDevolucionFiltered = (gastosEmpresaData || []).filter(
          (g: any) => !(g.devolucion ?? false) && isGastoInversor(g)
        )
        const totalGastosPendientesDevolucion = gastosPendientesDevolucionFiltered.reduce(
          (sum: number, g: any) => sum + Number(g.amount || 0),
          0
        )
        const gastosPendientesDevolucionList = gastosPendientesDevolucionFiltered.slice(0, 15).map((g: any) => ({
          id: g.id,
          amount: Number(g.amount || 0),
          expense_date: g.expense_date,
          expense_type: g.expense_type || 'otros',
          description: g.description ?? null,
          inversor_name: g.inversor_name ?? null,
        }))

        const incomeFromSalesMonth = (incomeSalesDataMonth || []).reduce((sum: number, s: any) => sum + Number(s.margin || 0), 0)
        const incomeFromEmpresaMonth = ingresosEmpresaDelMes.reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0)
        const incomeFromEmpresaAllTime = ingresosEmpresaSoloOtrosSinDuplicados.reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0)
        const totalIncome = incomeFromSalesAllTime + incomeFromEmpresaAllTime
        const totalIncomeMonth = incomeFromSalesMonth + incomeFromEmpresaMonth
        const gastosDelMes = (gastosEmpresaData || []).filter(
          (g: any) => g.expense_date >= firstDayStr && g.expense_date <= lastDayStr
        )
        const totalExpenses = gastosDelMes.reduce((sum: number, g: any) => sum + Number(g.amount || 0), 0)

        // Gastos agrupados por tipo (para gráfico de distribución)
        const expensesByType = (gastosEmpresaData || []).reduce(
          (acc: Array<{ type: string; amount: number }>, g: any) => {
            const type = g.expense_type || 'otros'
            const amount = Number(g.amount || 0)
            const existing = acc.find(item => item.type === type)
            if (existing) {
              existing.amount += amount
            } else {
              acc.push({ type, amount })
            }
            return acc
          },
          []
        )
        const balance = totalIncomeMonth - totalExpenses

        // Ventas por mes (últimos 6 meses) desde salesData
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        const monthBuckets = Array.from({ length: 6 }).map((_, idx) => {
          const date = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1)
          return {
            key: `${date.getFullYear()}-${date.getMonth()}`,
            month: monthNames[date.getMonth()],
            sales: 0,
            revenue: 0,
          }
        })

        const monthBucketMap = new Map(monthBuckets.map(bucket => [bucket.key, bucket]))
        for (const sale of salesData) {
          const saleDate = new Date(sale.sale_date)
          const bucketKey = `${saleDate.getFullYear()}-${saleDate.getMonth()}`
          const bucket = monthBucketMap.get(bucketKey)
          if (bucket) {
            bucket.sales += 1
            bucket.revenue += Number(sale.sale_price || 0)
          }
        }

        const salesByMonth = monthBuckets

        // Vehículos por categoría
        const vehiclesByCategory = vehiclesData?.reduce((acc: Array<{ category: string; count: number }>, v) => {
          const existing = acc.find(item => item.category === v.category)
          if (existing) {
            existing.count++
          } else {
            acc.push({ category: v.category, count: 1 })
          }
          return acc
        }, []) || []

        const recentSalesData = recentSalesRes?.data || []
        const recentSales = (recentSalesData || []).map((sale: any) => {
          const vehicleName = sale.vehicle_description?.trim() ||
            (sale.vehicle
              ? [sale.vehicle.make, sale.vehicle.model, sale.vehicle.year].filter(Boolean).join(' ').trim()
              : 'Vehículo') || 'Vehículo'
          const sellerName = sale.seller?.full_name || 'N/A'
          const clientName = sale.client_name?.trim() || sale.lead?.full_name || 'PENDIENTE'

          return {
            id: sale.id,
            vehicle: vehicleName,
            amount: Number(sale.sale_price || 0),
            date: sale.sale_date,
            seller: sellerName,
            clientName,
            margin: Number(sale.margin || 0),
            status: sale.status ?? 'pendiente',
            payment_status: sale.payment_status ?? null,
            commission_credit_status: sale.commission_credit_status ?? null,
            stock_origin: sale.stock_origin ?? null,
          }
        })

        const result = {
          salesThisMonth,
          salesRevenue,
          salesThisMonthList,
          totalIncome,
          totalIncomeFromSales: incomeFromSalesAllTime,
          totalIncomeFromEmpresa: incomeFromEmpresaAllTime,
          recentIngresosEmpresa,
          allIncomeList,
          totalExpenses,
          balance,
          totalVehicles,
          availableVehicles,
          activeLeads,
          scheduledAppointments,
          salesByMonth,
          vehiclesByCategory,
          expensesByType,
          leadsByStatus,
          recentSales,
          recentGastos,
          totalIngresosPendientes,
          ingresosPendientesList,
          totalGastosPendientesDevolucion,
          gastosPendientesDevolucionList
        }

        return result
      } catch {
        // Retornar datos vacíos en caso de error
        return {
          salesThisMonth: 0,
          salesRevenue: 0,
          salesThisMonthList: [],
          totalIncome: 0,
          totalIncomeFromSales: 0,
          totalIncomeFromEmpresa: 0,
          recentIngresosEmpresa: [],
          allIncomeList: [],
          totalExpenses: 0,
          balance: 0,
          totalVehicles: 0,
          availableVehicles: 0,
          activeLeads: 0,
          scheduledAppointments: 0,
          salesByMonth: [],
          vehiclesByCategory: [],
          expensesByType: [],
          leadsByStatus: [],
          recentSales: [],
          recentGastos: [],
          totalIngresosPendientes: 0,
          ingresosPendientesList: [],
          totalGastosPendientesDevolucion: 0,
          gastosPendientesDevolucionList: []
        }
      }
    },
    enabled: true,
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
    retry: 1 // Solo reintentar 1 vez
  })
}
