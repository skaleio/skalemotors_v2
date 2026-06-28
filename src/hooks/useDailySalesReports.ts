import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  buildDailyReportSupervisionRows,
  fetchDailyReportById,
  fetchMonthlyEffectiveConsignmentsCount,
  fetchMyDailySalesReport,
  fetchUserReportMetrics,
  submitDailySalesReport,
  syncDailySalesReportTasks,
} from "@/lib/services/dailySalesReports";
import type { DailySalesReportPayload } from "@/lib/types/dailySalesReport";
import { chileTodayIsoDate } from "@/lib/types/dailySalesReport";

export function dailySalesReportQueryKey(parts: Record<string, string | null | undefined>) {
  return ["daily-sales-report", parts] as const;
}

export function useSyncDailySalesReportTasks(
  reportDate: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: dailySalesReportQueryKey({ sync: reportDate }),
    queryFn: () => syncDailySalesReportTasks(reportDate),
    enabled,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
}

export function useMyDailySalesReport(
  userId: string | undefined,
  reportDate: string,
  enabled = true,
) {
  return useQuery({
    queryKey: dailySalesReportQueryKey({ mine: userId, date: reportDate }),
    queryFn: () => fetchMyDailySalesReport(userId!, reportDate),
    enabled: enabled && !!userId,
    staleTime: 30 * 1000,
  });
}

export function useDailyReportSupervision(input: {
  tenantId?: string | null;
  branchId?: string | null;
  reportDate: string;
  scope: "branch" | "tenant";
  enabled?: boolean;
}) {
  const enabled =
    (input.enabled ?? true) &&
    !!input.tenantId &&
    (input.scope === "tenant" || !!input.branchId);

  return useQuery({
    queryKey: dailySalesReportQueryKey({
      supervision: input.tenantId,
      branch: input.branchId,
      date: input.reportDate,
      scope: input.scope,
    }),
    queryFn: () =>
      buildDailyReportSupervisionRows({
        tenantId: input.tenantId!,
        reportDate: input.reportDate,
        branchId: input.branchId,
        scope: input.scope,
      }),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useDailyReportDetail(reportId: string | null, enabled = true) {
  return useQuery({
    queryKey: dailySalesReportQueryKey({ detail: reportId }),
    queryFn: () => fetchDailyReportById(reportId!),
    enabled: enabled && !!reportId,
  });
}

export function useSubmitDailySalesReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitDailySalesReport,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["daily-sales-report"] });
      void queryClient.invalidateQueries({ queryKey: ["pending-tasks"] });
      void queryClient.invalidateQueries({
        queryKey: dailySalesReportQueryKey({
          mine: variables.userId,
          date: variables.reportDate,
        }),
      });
    },
  });
}

export function useMonthlyEffectiveConsignments(
  userId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: dailySalesReportQueryKey({ consignmentsMonth: userId }),
    queryFn: () => fetchMonthlyEffectiveConsignmentsCount(userId!),
    enabled: enabled && !!userId,
    staleTime: 30 * 1000,
  });
}

export function useUserReportMetrics(
  userId: string | undefined,
  days = 30,
  enabled = true,
) {
  return useQuery({
    queryKey: dailySalesReportQueryKey({ metrics: userId, days: String(days) }),
    queryFn: () => fetchUserReportMetrics(userId!, days),
    enabled: enabled && !!userId,
    staleTime: 60 * 1000,
  });
}

export function useChileTodayDate() {
  return chileTodayIsoDate();
}
