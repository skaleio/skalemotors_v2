import { leadsAssignedToForQuery, leadsBranchIdForQuery } from "@/lib/leadsScope";
import { leadService } from "@/lib/services/leads";
import { vehicleService } from "@/lib/services/vehicles";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

const MIN_QUERY_LEN = 2;
const RESULT_LIMIT = 12;
const DEBOUNCE_MS = 300;

export type GlobalSearchResult = {
  id: string;
  type: "vehicle" | "lead";
  title: string;
  description: string;
  url: string;
  highlightId?: string;
};

type UseGlobalSearchOptions = {
  query: string;
  enabled: boolean;
  branchId?: string;
  role?: string | null;
  userId?: string;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export function mapGlobalSearchResults(
  vehicles: Awaited<ReturnType<typeof vehicleService.getAll>>,
  leads: Awaited<ReturnType<typeof leadService.getAll>>,
): GlobalSearchResult[] {
  const results: GlobalSearchResult[] = [];

  for (const vehicle of vehicles) {
    results.push({
      id: `vehicle-${vehicle.id}`,
      type: "vehicle",
      title: `${vehicle.make} ${vehicle.model} (${vehicle.year})`,
      description: `VIN: ${vehicle.vin ?? "—"} | Color: ${vehicle.color ?? "—"} | $${Number(vehicle.price || 0).toLocaleString("es-CL")}`,
      url: "/app/consignaciones",
      highlightId: vehicle.id,
    });
  }

  for (const lead of leads) {
    results.push({
      id: `lead-${lead.id}`,
      type: "lead",
      title: `Lead: ${lead.full_name}`,
      description: `Tel: ${lead.phone ?? "—"} | Email: ${lead.email || "—"} | Estado: ${lead.status}`,
      url: `/app/leads?openLead=${lead.id}`,
      highlightId: lead.id,
    });
  }

  return results;
}

export function useGlobalSearch({
  query,
  enabled,
  branchId,
  role,
  userId,
}: UseGlobalSearchOptions) {
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const trimmed = debouncedQuery.trim();
  const shouldFetch = enabled && trimmed.length >= MIN_QUERY_LEN;
  const assignedTo = leadsAssignedToForQuery(role, userId);
  const leadsBranchId = leadsBranchIdForQuery(role, branchId);

  const vehiclesQuery = useQuery({
    queryKey: ["global-search", "vehicles", branchId, trimmed],
    queryFn: () =>
      vehicleService.getAll({
        branchId,
        search: trimmed,
        mode: "search",
        limit: RESULT_LIMIT,
      }),
    enabled: shouldFetch,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const leadsQuery = useQuery({
    queryKey: ["global-search", "leads", leadsBranchId, assignedTo, trimmed],
    queryFn: () =>
      leadService.getAll({
        branchId: leadsBranchId,
        assignedTo,
        search: trimmed,
        limit: RESULT_LIMIT,
      }),
    enabled: shouldFetch,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const results = useMemo(
    () =>
      mapGlobalSearchResults(
        vehiclesQuery.data ?? [],
        leadsQuery.data ?? [],
      ),
    [vehiclesQuery.data, leadsQuery.data],
  );

  const isSearching =
    shouldFetch && (vehiclesQuery.isFetching || leadsQuery.isFetching);

  return {
    results,
    isSearching,
    minQueryLength: MIN_QUERY_LEN,
    hasQuery: trimmed.length > 0,
    queryTooShort: trimmed.length > 0 && trimmed.length < MIN_QUERY_LEN,
    error: vehiclesQuery.error ?? leadsQuery.error ?? null,
  };
}
