import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { tramitesService, type TramiteWithRelations } from "@/lib/services/tramites";
import type { Database } from "@/lib/types/database";

type TramiteInsert = Database["public"]["Tables"]["tramites"]["Insert"];
type TramiteUpdate = Database["public"]["Tables"]["tramites"]["Update"];

export function useTramiteTipos() {
  return useQuery({
    queryKey: ["tramite-tipos"],
    queryFn: () => tramitesService.getTipos(),
  });
}

export function useTramites(filters?: { branchId?: string; status?: string; tramiteTipoCode?: string }) {
  return useQuery({
    queryKey: ["tramites", filters?.branchId, filters?.status, filters?.tramiteTipoCode],
    queryFn: () => tramitesService.getAll(filters),
  });
}

export function useCreateTramite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TramiteInsert) => tramitesService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tramites"] });
    },
  });
}

export function useUpdateTramite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: TramiteUpdate }) =>
      tramitesService.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tramites"] });
    },
  });
}

export function useAutofactConfig(branchId: string | undefined) {
  return useQuery({
    queryKey: ["autofact-config", branchId],
    queryFn: () => (branchId ? tramitesService.getAutofactConfig(branchId) : Promise.resolve(null)),
    enabled: !!branchId,
  });
}
