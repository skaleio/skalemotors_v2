import { useQuery } from '@tanstack/react-query'
import {
  saleBreakdownService,
  type LibroVentaRow,
} from '@/lib/services/saleBreakdown'
import { saleCascadeSettingsService } from '@/lib/services/saleCascadeSettings'
import type { CascadaSettings } from '@/lib/finance/saleBreakdownSnapshot'

export interface LibroVentasData {
  rows: LibroVentaRow[]
  settings: CascadaSettings | null
}

// Libro de Ventas del tenant actual (RLS filtra por tenant).
export function useLibroVentas() {
  return useQuery<LibroVentasData>({
    queryKey: ['libro-ventas'],
    queryFn: async () => {
      const [rows, settings] = await Promise.all([
        saleBreakdownService.listLibro(),
        saleCascadeSettingsService.getCurrent(),
      ])
      return { rows, settings }
    },
  })
}
