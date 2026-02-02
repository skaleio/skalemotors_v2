import { appointmentService } from "@/lib/services/appointments";
import type { Database } from "@/lib/types/database";
import { useQuery } from "@tanstack/react-query";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"];

interface UseAppointmentsOptions {
  userId?: string;
  branchId?: string;
  leadId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  enabled?: boolean;
}

export function useAppointments(options: UseAppointmentsOptions = {}) {
  const {
    userId,
    branchId,
    leadId,
    status,
    dateFrom,
    dateTo,
    enabled = true,
  } = options;

  const queryKey = ["appointments", userId, branchId, leadId, status, dateFrom, dateTo];

  const { data = [], isLoading: loading, error, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      appointmentService.getAll({
        userId,
        branchId,
        leadId,
        status,
        dateFrom,
        dateTo,
      }),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
  });

  return {
    appointments: data as Appointment[],
    loading,
    error: error as Error | null,
    refetch,
  };
}
