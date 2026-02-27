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

  const { data: vehicles = [], isLoading: loading, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: () => vehicleService.getAll({
      branchId,
      status,
      category,
      search
    }),
    enabled: enabled && !!branchId, // Solo habilitar si hay branchId
    staleTime, // Los datos se consideran frescos (evita refetches innecesarios)
    gcTime, // Mantener en cache
    refetchOnWindowFocus: false, // Evita refetch al cambiar ventana que a veces falla y deja vacío
    refetchOnMount: true, // Al montar usa cache si hay y está fresco; si no, carga
    retry: 3, // Más reintentos para redes lentas o inestables
    retryDelay: (attemptIndex) => Math.min(800 * 2 ** attemptIndex, 8000), // Backoff: ~0.8s, 1.6s, 3.2s
  })

  return {
    vehicles: vehicles as Vehicle[],
    loading,
    isFetching,
    error: error as Error | null,
    refetch
  }
}
