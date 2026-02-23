import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'

interface DashboardStats {
  salesThisMonth: number
  salesRevenue: number
  totalIncome: number
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
}

export function useDashboardStats(branchId?: string) {
  return useQuery({
    queryKey: ['dashboard-stats', branchId],
    queryFn: async (): Promise<DashboardStats> => {
      try {
        console.log('🔄 Iniciando carga de estadísticas para branch:', branchId)
        const now = new Date()
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        console.log('📅 Primer día del mes:', firstDayOfMonth.toISOString().split('T')[0])
        const timeoutMs = 30000 // 30s para consultas pesadas

        const withTimeout = async <T,>(promise: Promise<T>, label: string): Promise<T> => {
          return await Promise.race([
            promise,
            new Promise<T>((_, reject) =>
              setTimeout(() => {
                console.error(`⏱️ Timeout en ${label} después de ${timeoutMs}ms`)
                reject(new Error(`Timeout en ${label}`))
              }, timeoutMs)
            ),
          ])
        }

        // Función helper para manejar errores sin romper todo
        const safeQuery = async <T,>(promise: Promise<T>, label: string, defaultValue: T): Promise<T> => {
          try {
            return await withTimeout(promise, label)
          } catch (error) {
            console.error(`❌ Error en ${label}:`, error)
            return defaultValue
          }
        }

        // 1. Ventas últimos 6 meses (una sola consulta)
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
        let salesQueryBuilder = supabase
          .from('sales')
          .select('sale_price, sale_date')
          .gte('sale_date', sixMonthsAgo.toISOString().split('T')[0])
          .eq('status', 'completada')

        if (branchId) {
          salesQueryBuilder = salesQueryBuilder.eq('branch_id', branchId)
        }

        console.log('🔍 Ejecutando salesQuery (6 meses)...')
        const salesResult = await safeQuery(
          salesQueryBuilder.then(res => res),
          'salesQuery',
          { data: null, error: null }
        )

        const salesData = salesResult?.data || []

        const salesThisMonth = salesData.filter((s: any) => {
          const saleDate = new Date(s.sale_date)
          return saleDate >= firstDayOfMonth
        }).length
        const salesRevenue = salesData
          .filter((s: any) => new Date(s.sale_date) >= firstDayOfMonth)
          .reduce((sum: number, s: any) => sum + Number(s.sale_price || 0), 0)

        console.log('✅ Sales data:', { salesThisMonth, salesRevenue })

        // 2. Total de vehículos en inventario
        let vehiclesQueryBuilder = supabase
          .from('vehicles')
          .select('id, status, category')

        if (branchId) {
          vehiclesQueryBuilder = vehiclesQueryBuilder.eq('branch_id', branchId)
        }

        console.log('🔍 Ejecutando vehiclesQuery...')
        const vehiclesResult = await safeQuery(
          vehiclesQueryBuilder.then(res => res),
          'vehiclesQuery',
          { data: null, error: null }
        )

        console.log('📦 vehiclesResult completo:', vehiclesResult)
        console.log('📦 vehiclesResult.data type:', typeof vehiclesResult?.data, Array.isArray(vehiclesResult?.data))
        const vehiclesData = vehiclesResult?.data || []
        console.log('📦 vehiclesData array length:', vehiclesData.length)
        console.log('📦 vehiclesData:', vehiclesData)

        const totalVehicles = vehiclesData?.length || 0
        const availableVehicles = vehiclesData?.filter((v: any) => v.status === 'disponible').length || 0

        console.log('✅ Vehicles data:', { totalVehicles, availableVehicles, vehiclesData })

        // 3. Leads por estado (y activos desde el mismo set)
        let allLeadsQuery = supabase
          .from('leads')
          .select('status')

        if (branchId) {
          allLeadsQuery = allLeadsQuery.eq('branch_id', branchId)
        }

        const { data: allLeadsData } = await safeQuery(
          allLeadsQuery.then(res => res),
          'allLeadsQuery',
          { data: null, error: null }
        )

        const leadsByStatus = allLeadsData?.reduce((acc: Array<{ status: string; count: number }>, l) => {
          const existing = acc.find(item => item.status === l.status)
          if (existing) {
            existing.count++
          } else {
            acc.push({ status: l.status, count: 1 })
          }
          return acc
        }, []) || []

        const inactiveLeadStatuses = new Set(['vendido', 'perdido'])
        const activeLeads = (allLeadsData || []).filter((l: any) => !inactiveLeadStatuses.has(l.status)).length

        console.log('✅ Leads data:', { activeLeads, leadsByStatus })

        // 4. Citas programadas (futuras y pendientes)
        let appointmentsQuery = supabase
          .from('appointments')
          .select('id')
          .gte('scheduled_at', now.toISOString())
          .eq('status', 'programada')

        if (branchId) {
          appointmentsQuery = appointmentsQuery.eq('branch_id', branchId)
        }

        const { data: appointmentsData } = await safeQuery(
          appointmentsQuery.then(res => res),
          'appointmentsQuery',
          { data: null, error: null }
        )

        const scheduledAppointments = appointmentsData?.length || 0

        console.log('✅ Appointments data:', { scheduledAppointments })

        // 5. Total ingresos y balance (ventas completadas con pago realizado + ingresos_empresa - gastos_empresa)
        let incomeFromSalesQuery = supabase
          .from('sales')
          .select('margin')
          .eq('status', 'completada')
          .eq('payment_status', 'realizado')

        if (branchId) {
          incomeFromSalesQuery = incomeFromSalesQuery.eq('branch_id', branchId)
        }

        const { data: incomeSalesData } = await safeQuery(
          incomeFromSalesQuery.then(res => res),
          'incomeFromSalesQuery',
          { data: null, error: null }
        )

        let ingresosEmpresaQuery = supabase.from('ingresos_empresa').select('amount, payment_status')
        if (branchId) {
          ingresosEmpresaQuery = ingresosEmpresaQuery.eq('branch_id', branchId)
        }
        const { data: ingresosEmpresaData } = await safeQuery(
          ingresosEmpresaQuery.then(res => res),
          'ingresosEmpresaQuery',
          { data: null, error: null }
        )

        let gastosEmpresaQuery = supabase.from('gastos_empresa').select('amount, expense_type')
        if (branchId) {
          gastosEmpresaQuery = gastosEmpresaQuery.eq('branch_id', branchId)
        }
        const { data: gastosEmpresaData } = await safeQuery(
          gastosEmpresaQuery.then(res => res),
          'gastosEmpresaQuery',
          { data: null, error: null }
        )

        const incomeFromSales = (incomeSalesData || []).reduce((sum: number, s: any) => sum + Number(s.margin || 0), 0)
        const incomeFromEmpresa = (ingresosEmpresaData || []).reduce(
          (sum: number, i: any) => sum + ((i.payment_status === 'realizado' ? Number(i.amount || 0) : 0)),
          0
        )
        const totalIncome = incomeFromSales + incomeFromEmpresa
        const totalExpenses = (gastosEmpresaData || []).reduce((sum: number, g: any) => sum + Number(g.amount || 0), 0)

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
        const balance = totalIncome - totalExpenses

        console.log('✅ Financial data:', { totalIncome, totalExpenses, balance })

        // 7. Ventas por mes (últimos 6 meses) desde una sola consulta
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

        console.log('✅ Sales by month:', salesByMonth)

        // 8. Vehículos por categoría
        const vehiclesByCategory = vehiclesData?.reduce((acc: Array<{ category: string; count: number }>, v) => {
          const existing = acc.find(item => item.category === v.category)
          if (existing) {
            existing.count++
          } else {
            acc.push({ category: v.category, count: 1 })
          }
          return acc
        }, []) || []

        console.log('✅ Vehicles by category:', vehiclesByCategory)

        // 9. Ventas recientes (últimas 5) con joins
        let recentSalesQuery = supabase
          .from('sales')
          .select(`
            id, sale_price, sale_date, vehicle_description, client_name, margin, status,
            payment_status, commission_credit_status, stock_origin,
            vehicle:vehicles (make, model, year),
            seller:users (full_name)
          `)
          .order('sale_date', { ascending: false })
          .limit(5)

        if (branchId) {
          recentSalesQuery = recentSalesQuery.eq('branch_id', branchId)
        }

        const { data: recentSalesData } = await safeQuery(
          recentSalesQuery.then(res => res),
          'recentSalesQuery',
          { data: null, error: null }
        )

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

        console.log('✅ Recent sales:', recentSales)

        const result = {
          salesThisMonth,
          salesRevenue,
          totalIncome,
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
          recentSales
        }

        console.log('✅ Dashboard stats complete:', result)

        return result
      } catch (error) {
        console.error('❌ Error in useDashboardStats:', error)
        // Retornar datos vacíos en caso de error
        return {
          salesThisMonth: 0,
          salesRevenue: 0,
          totalIncome: 0,
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
          recentSales: []
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
