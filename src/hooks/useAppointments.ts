import { appointmentService } from "@/lib/services/appointments";
import type { Database } from "@/lib/types/database";
import { useQuery } from "@tanstack/react-query";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"];

interface UseAppointmentsOptions {
  userId?: string;
  tenantId?: string;
  branchId?: string;
  leadId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  enabled?: boolean;
  /** Refresca al montar y al volver a la pestaña (p. ej. citas desde landing). */
  live?: boolean;
}

export function useAppointments(options: UseAppointmentsOptions = {}) {
  const {
    userId,
    tenantId,
    branchId,
    leadId,
    status,
    dateFrom,
    dateTo,
    enabled = true,
    live = false,
  } = options;

  const queryKey = ["appointments", userId, tenantId, branchId, leadId, status, dateFrom, dateTo];

  const { data = [], isLoading: loading, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      appointmentService.getAll({
        userId,
        tenantId,
        branchId,
        leadId,
        status,
        dateFrom,
        dateTo,
      }),
    enabled,
    staleTime: live ? 30 * 1000 : 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: live,
    refetchOnMount: live,
    refetchInterval: live ? 60 * 1000 : false,
    retry: 2,
  });

  return {
    appointments: data as Appointment[],
    loading,
    isFetching,
    error: error as Error | null,
    refetch,
  };
}
