import { vehicleService } from '@/lib/services/vehicles'
import type { Database } from '@/lib/types/database'
import { useQuery } from '@tanstack/react-query'

type Vehicle = Database['public']['Tables']['vehicles']['Row']

interface UseVehiclesOptions {
  branchId?: string
  status?: string
  category?: string
  search?: string
  enabled?: boolean
  staleTime?: number // Tiempo en ms antes de considerar los datos obsoletos
  gcTime?: number // Tiempo en ms antes de eliminar datos del cache
}

export function useVehicles(options: UseVehiclesOptions = {}) {
  const {
    branchId,
    status,
    category,
    search,
    enabled = true,
    staleTime = 5 * 60 * 1000, // 5 minutos por defecto
    gcTime = 10 * 60 * 1000 // 10 minutos por defecto
  } = options

  const queryKey = ['vehicles', branchId, status, category, search]

  const { data: vehicles = [], isLoading: loading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => vehicleService.getAll({
      branchId,
      status,
      category,
      search
    }),
    enabled: enabled && !!branchId, // Solo habilitar si hay branchId
    staleTime, // Los datos se consideran frescos por 5 minutos
    gcTime, // Mantener en cache por 10 minutos
    refetchOnWindowFocus: true, // Refetch al cambiar de ventana
    refetchOnMount: true, // Refetch al montar si hay datos en cache
    retry: 2, // Reintentar 2 veces en caso de error
  })

  return {
    vehicles: vehicles as Vehicle[],
    loading,
    error: error as Error | null,
    refetch
  }
}
