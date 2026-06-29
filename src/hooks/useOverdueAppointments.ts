import { appointmentService } from "@/lib/services/appointments";
import type { Database } from "@/lib/types/database";
import { useQuery } from "@tanstack/react-query";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"];

/**
 * Citas vencidas sin resolver del vendedor logueado. Alimentan el modal
 * bloqueante que obliga a registrar qué pasó con cada cita pasada.
 */
export function useOverdueAppointments(userId: string | undefined, enabled = true) {
  const { data = [], refetch, isLoading } = useQuery({
    queryKey: ["appointments", "overdue-unresolved", userId],
    queryFn: () => appointmentService.getOverdueUnresolved(userId!),
    enabled: enabled && !!userId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return { overdue: data as Appointment[], refetch, isLoading };
}
