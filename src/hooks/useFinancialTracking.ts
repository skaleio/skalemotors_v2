import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'

export type DateRangePreset = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year'

export interface FinancialByMonth {
  monthKey: string
  monthLabel: string
  income: number
  expenses: number
  balance: number
  balanceAccumulated: number
  salesCount: number
  salesRevenue: number
}

export interface ExpenseByCategory {
  type: string
  amount: number
}

export interface ExpenseByInversor {
  name: string
  amount: number
}

export interface RecentExpense {
  id: string
  amount: number
  description: string | null
  expense_date: string
  expense_type: string
  inversor_name: string | null
}

export interface RecentIncome {
  date: string
  amount: number
  description: string
  source: 'sale' | 'other'
}

export interface FinancialTrackingData {
  totalIncome: number
  totalExpenses: number
  balance: number
  marginPercent: number
  salesCount: number
  salesRevenue: number
  incomeFromSales: number
  incomeFromOther: number
  byMonth: FinancialByMonth[]
  expensesByCategory: ExpenseByCategory[]
  expensesByInversor: ExpenseByInversor[]
  recentExpenses: RecentExpense[]
  recentIncome: RecentIncome[]
}

function getDateRange(preset: DateRangePreset): { from: string; to: string } {
  const now = new Date()
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let from: Date

  switch (preset) {
    case 'this_month':
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'last_month':
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      to.setFullYear(now.getFullYear(), now.getMonth() - 1, 31)
      break
    case 'last_3_months':
      from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      break
    case 'last_6_months':
      from = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      break
    case 'this_year':
      from = new Date(now.getFullYear(), 0, 1)
      break
    default:
      from = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  }

  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0]
  }
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function useFinancialTracking(branchId?: string | null, preset: DateRangePreset = 'last_6_months') {
  const { from, to } = getDateRange(preset)

  return useQuery({
    queryKey: ['financial-tracking', branchId, preset, from, to],
    queryFn: async (): Promise<FinancialTrackingData> => {
      // 1. Ventas completadas con pago realizado (margin = ganancia)
      let salesQuery = supabase
        .from('sales')
        .select('id, sale_price, sale_date, margin, vehicle_description')
        .eq('status', 'completada')
        .eq('payment_status', 'realizado')
        .gte('sale_date', from)
        .lte('sale_date', to)

      if (branchId) {
        salesQuery = salesQuery.eq('branch_id', branchId)
      }

      const { data: salesData } = await salesQuery

      // 2. Ingresos empresa (otros ingresos: comisión crédito, etc.) — solo cuentan los con payment_status realizado
      let ingresosQuery = supabase
        .from('ingresos_empresa')
        .select('id, amount, income_date, description, etiqueta, payment_status')
        .gte('income_date', from)
        .lte('income_date', to)

      if (branchId) {
        ingresosQuery = ingresosQuery.eq('branch_id', branchId)
      }

      const { data: ingresosData } = await ingresosQuery

      // 3. Gastos empresa (con tipo e inversor para desgloses)
      let gastosQuery = supabase
        .from('gastos_empresa')
        .select('id, amount, expense_date, expense_type, inversor_name, description')
        .gte('expense_date', from)
        .lte('expense_date', to)

      if (branchId) {
        gastosQuery = gastosQuery.eq('branch_id', branchId)
      }

      const { data: gastosData } = await gastosQuery

      const sales = salesData ?? []
      const ingresos = ingresosData ?? []
      const gastos = gastosData ?? []

      const incomeFromSales = sales.reduce((sum: number, s: any) => sum + Number(s.margin ?? 0), 0)
      const ingresosRealizados = ingresos.filter((i: any) => (i.payment_status ?? 'realizado') === 'realizado')
      const incomeFromOther = ingresosRealizados.reduce((sum: number, i: any) => sum + Number(i.amount ?? 0), 0)
      const totalIncome = incomeFromSales + incomeFromOther
      const totalExpenses = gastos.reduce((sum: number, g: any) => sum + Number(g.amount ?? 0), 0)
      const balance = totalIncome - totalExpenses
      const salesRevenue = sales.reduce((sum: number, s: any) => sum + Number(s.sale_price ?? 0), 0)
      const marginPercent = totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 0

      // Agrupar por mes para gráficos
      const monthMap = new Map<string, { income: number; expenses: number; salesCount: number; salesRevenue: number }>()

      const addMonth = (key: string) => {
        if (!monthMap.has(key)) {
          const [y, m] = key.split('-').map(Number)
          monthMap.set(key, { income: 0, expenses: 0, salesCount: 0, salesRevenue: 0 })
        }
      }

      sales.forEach((s: any) => {
        const d = new Date(s.sale_date)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        addMonth(key)
        const bucket = monthMap.get(key)!
        bucket.income += Number(s.margin ?? 0)
        bucket.salesCount += 1
        bucket.salesRevenue += Number(s.sale_price ?? 0)
      })

      ingresosRealizados.forEach((i: any) => {
        const d = new Date(i.income_date)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        addMonth(key)
        const bucket = monthMap.get(key)!
        bucket.income += Number(i.amount ?? 0)
      })

      gastos.forEach((g: any) => {
        const d = new Date(g.expense_date)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        addMonth(key)
        const bucket = monthMap.get(key)!
        bucket.expenses += Number(g.amount ?? 0)
      })

      // Ordenar meses y construir byMonth con balance acumulado (running total)
      const sortedKeys = Array.from(monthMap.keys()).sort()
      let accumulated = 0
      const byMonth: FinancialByMonth[] = sortedKeys.map(key => {
        const b = monthMap.get(key)!
        const [y, m] = key.split('-').map(Number)
        const balanceMonth = b.income - b.expenses
        accumulated += balanceMonth
        return {
          monthKey: key,
          monthLabel: `${MONTH_NAMES[m]} ${y}`,
          income: b.income,
          expenses: b.expenses,
          balance: balanceMonth,
          balanceAccumulated: accumulated,
          salesCount: b.salesCount,
          salesRevenue: b.salesRevenue
        }
      })

      // Gastos por categoría (expense_type)
      const categoryMap = new Map<string, number>()
      gastos.forEach((g: any) => {
        const t = g.expense_type || 'otros'
        categoryMap.set(t, (categoryMap.get(t) ?? 0) + Number(g.amount ?? 0))
      })
      const expensesByCategory: ExpenseByCategory[] = Array.from(categoryMap.entries())
        .map(([type, amount]) => ({ type, amount }))
        .sort((a, b) => b.amount - a.amount)

      // Gastos por inversor
      const inversorMap = new Map<string, number>()
      gastos.forEach((g: any) => {
        const name = (g.inversor_name || '').trim() || 'Sin asignar'
        inversorMap.set(name, (inversorMap.get(name) ?? 0) + Number(g.amount ?? 0))
      })
      const expensesByInversor: ExpenseByInversor[] = Array.from(inversorMap.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)

      // Últimos gastos (ordenar por fecha desc, tomar 8)
      const recentExpenses: RecentExpense[] = [...gastos]
        .sort((a: any, b: any) => (b.expense_date || '').localeCompare(a.expense_date || ''))
        .slice(0, 8)
        .map((g: any) => ({
          id: g.id,
          amount: Number(g.amount ?? 0),
          description: g.description ?? null,
          expense_date: g.expense_date,
          expense_type: g.expense_type || 'otros',
          inversor_name: g.inversor_name ?? null
        }))

      // Últimos ingresos: ventas + ingresos empresa, merge y ordenar por fecha desc
      const incomeFromSalesList: RecentIncome[] = (sales as any[]).map((s: any) => ({
        date: s.sale_date,
        amount: Number(s.margin ?? 0),
        description: (s.vehicle_description || 'Venta').toString().slice(0, 50),
        source: 'sale' as const
      }))
      const incomeFromOtherList: RecentIncome[] = (ingresosRealizados as any[]).map((i: any) => ({
        date: i.income_date,
        amount: Number(i.amount ?? 0),
        description: (i.etiqueta || i.description || 'Otro ingreso').toString().slice(0, 50),
        source: 'other' as const
      }))
      const recentIncome: RecentIncome[] = [...incomeFromSalesList, ...incomeFromOtherList]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 8)

      return {
        totalIncome,
        totalExpenses,
        balance,
        marginPercent,
        salesCount: sales.length,
        salesRevenue,
        incomeFromSales,
        incomeFromOther,
        byMonth,
        expensesByCategory,
        expensesByInversor,
        recentExpenses,
        recentIncome
      }
    },
    enabled: true,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000
  })
}
