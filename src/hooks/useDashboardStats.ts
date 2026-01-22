import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface DashboardStats {
  salesThisMonth: number
  salesRevenue: number
  totalVehicles: number
  availableVehicles: number
  activeLeads: number
  scheduledAppointments: number
  salesByMonth: Array<{ month: string; sales: number; revenue: number }>
  vehiclesByCategory: Array<{ category: string; count: number }>
  leadsByStatus: Array<{ status: string; count: number }>
  recentSales: Array<{
    id: string
    vehicle: string
    amount: number
    date: string
    seller: string
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
        const timeoutMs = 20000 // Aumentado a 20 segundos

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

        // 1. Ventas del mes actual (simplificado)
        let salesQueryBuilder = supabase
          .from('sales')
          .select('sale_price, sale_date, status')
          .gte('sale_date', firstDayOfMonth.toISOString().split('T')[0])

        if (branchId) {
          salesQueryBuilder = salesQueryBuilder.eq('branch_id', branchId)
        }

        console.log('🔍 Ejecutando salesQuery...')
        const salesResult = await safeQuery(
          salesQueryBuilder.then(res => res),
          'salesQuery',
          { data: null, error: null }
        )

        console.log('📦 salesResult completo:', salesResult)
        console.log('📦 salesResult.data type:', typeof salesResult?.data, Array.isArray(salesResult?.data))
        const salesData = salesResult?.data || []
        console.log('📦 salesData array length:', salesData.length)
        console.log('📦 salesData content:', salesData)

        const completedSales = salesData?.filter((s: any) => s.status === 'completada') || []
        console.log('📦 completedSales filtered:', completedSales)
        
        const salesThisMonth = completedSales.length
        const salesRevenue = completedSales.reduce((sum: number, s: any) => sum + Number(s.sale_price || 0), 0)

        console.log('✅ Sales data:', { salesThisMonth, salesRevenue, completedSales })

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

        // 3. Leads activos (no vendidos ni perdidos)
        let leadsQuery = supabase
          .from('leads')
          .select('id, status')
          .not('status', 'in', '("vendido","perdido")')

        if (branchId) {
          leadsQuery = leadsQuery.eq('branch_id', branchId)
        }

        const { data: leadsData } = await safeQuery(
          leadsQuery.then(res => res),
          'leadsQuery',
          { data: null, error: null }
        )

        const activeLeads = leadsData?.length || 0

        console.log('✅ Leads data:', { activeLeads })

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

        // 5. Ventas por mes (últimos 6 meses) - simplificado
        const salesByMonth: Array<{ month: string; sales: number; revenue: number }> = []
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        
        const monthQueries = Array.from({ length: 6 }).map((_, idx) => {
          const i = 5 - idx
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)

          let monthSalesQuery = supabase
            .from('sales')
            .select('sale_price, status')
            .gte('sale_date', date.toISOString().split('T')[0])
            .lt('sale_date', nextMonth.toISOString().split('T')[0])
            .eq('status', 'completada')

          if (branchId) {
            monthSalesQuery = monthSalesQuery.eq('branch_id', branchId)
          }

          return safeQuery(monthSalesQuery.then(res => res), `monthSalesQuery-${idx}`, { data: null, error: null }).then(({ data }) => {
            const monthSales = data?.length || 0
            const monthRevenue = data?.reduce((sum, s) => sum + Number(s.sale_price || 0), 0) || 0
            return {
              month: monthNames[date.getMonth()],
              sales: monthSales,
              revenue: monthRevenue,
            }
          }).catch(() => ({
            month: monthNames[date.getMonth()],
            sales: 0,
            revenue: 0,
          }))
        })

        const monthResults = await Promise.all(monthQueries)
        salesByMonth.push(...monthResults)

        console.log('✅ Sales by month:', salesByMonth)

        // 6. Vehículos por categoría
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

        // 7. Leads por estado
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

        console.log('✅ Leads by status:', leadsByStatus)

        // 8. Ventas recientes (últimas 5) - simplificado sin joins
        let recentSalesQuery = supabase
          .from('sales')
          .select('id, sale_price, sale_date, vehicle_id, seller_id')
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

        // Obtener detalles de vehículos y vendedores en paralelo
        const recentSales = await Promise.all(
          (recentSalesData || []).map(async (sale) => {
            const [vehicleResult, sellerResult] = await Promise.all([
              sale.vehicle_id
                ? safeQuery(
                    supabase.from('vehicles').select('make, model').eq('id', sale.vehicle_id).single().then(res => res),
                    'vehicleDetail',
                    { data: null, error: null }
                  )
                : Promise.resolve({ data: null }),
              sale.seller_id
                ? safeQuery(
                    supabase.from('users').select('full_name').eq('id', sale.seller_id).single().then(res => res),
                    'sellerDetail',
                    { data: null, error: null }
                  )
                : Promise.resolve({ data: null })
            ])

            const vehicleName = vehicleResult?.data
              ? `${vehicleResult.data.make} ${vehicleResult.data.model}`
              : 'Vehículo'
            const sellerName = sellerResult?.data?.full_name || 'N/A'

            return {
              id: sale.id,
              vehicle: vehicleName,
              amount: Number(sale.sale_price || 0),
              date: sale.sale_date,
              seller: sellerName,
            }
          })
        )

        console.log('✅ Recent sales:', recentSales)

        const result = {
          salesThisMonth,
          salesRevenue,
          totalVehicles,
          availableVehicles,
          activeLeads,
          scheduledAppointments,
          salesByMonth,
          vehiclesByCategory,
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
          totalVehicles: 0,
          availableVehicles: 0,
          activeLeads: 0,
          scheduledAppointments: 0,
          salesByMonth: [],
          vehiclesByCategory: [],
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
