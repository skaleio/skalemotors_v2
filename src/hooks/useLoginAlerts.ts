import { useAuth } from "@/contexts/AuthContext";
import {
  filterTasksForLoginRole,
  markLoginAlertsShown,
  shouldShowLoginAlerts,
  wasLoginAlertsShown,
} from "@/lib/loginAlerts";
import { leadService } from "@/lib/services/leads";
import {
  canSyncStaleAlerts,
  syncPendingTasksOnLogin,
} from "@/lib/services/pendingTasks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { usePendingTasks } from "./usePendingTasks";

type LoginAlertsExtras = {
  newLeadsCount: number;
};

export function useLoginAlerts() {
  const { user, loading: authLoading, needsOnboarding } = useAuth();
  const queryClient = useQueryClient();
  const syncStartedRef = useRef(false);
  const [readyToEvaluate, setReadyToEvaluate] = useState(false);

  const role = user?.role;
  const enabled =
    !authLoading
    && !!user?.id
    && !needsOnboarding
    && shouldShowLoginAlerts(role);

  const pendingCtx = {
    branchId: user?.branch_id,
    tenantId: user?.tenant_id,
    role: user?.role,
    userId: user?.id,
  };

  const {
    tasks: allTasks,
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = usePendingTasks(pendingCtx);

  const tasks = filterTasksForLoginRole(allTasks, role);

  const showLeadExtras =
    role === "vendedor"
    || role === "gerente"
    || role === "jefe_sucursal"
    || role === "admin"
    || role === "jefe_jefe";

  const extrasQuery = useQuery({
    queryKey: [
      "login-alerts-extras",
      user?.id,
      user?.branch_id,
      showLeadExtras,
    ],
    queryFn: async (): Promise<LoginAlertsExtras> => {
      if (!showLeadExtras || !user?.branch_id) {
        return { newLeadsCount: 0 };
      }
      const newLeadsCount = await leadService.countRecentNewLeads({
        branchId: user.branch_id,
        assignedTo:
          role === "vendedor" ? user.id : undefined,
        hours: 48,
      });
      return { newLeadsCount };
    },
    enabled: enabled && showLeadExtras && !!user?.branch_id,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!enabled || !user?.id) {
      setReadyToEvaluate(false);
      return;
    }
    if (wasLoginAlertsShown(user.id)) {
      setReadyToEvaluate(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      if (canSyncStaleAlerts(role) && !syncStartedRef.current) {
        syncStartedRef.current = true;
        await syncPendingTasksOnLogin();
        await queryClient.invalidateQueries({ queryKey: ["pending-tasks"] });
        await refetchTasks();
      }
      if (!cancelled) setReadyToEvaluate(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, user?.id, role, queryClient, refetchTasks]);

  const extras = extrasQuery.data ?? { newLeadsCount: 0 };
  const hasNewLeads = extras.newLeadsCount > 0;
  const hasTasks = tasks.length > 0;
  const dataLoading = tasksLoading || extrasQuery.isLoading;

  const shouldOpen =
    enabled
    && !!user?.id
    && !wasLoginAlertsShown(user.id)
    && readyToEvaluate
    && !dataLoading
    && (hasTasks || hasNewLeads);

  useEffect(() => {
    if (
      !enabled
      || !user?.id
      || wasLoginAlertsShown(user.id)
      || !readyToEvaluate
      || dataLoading
    ) {
      return;
    }
    if (!hasTasks && !hasNewLeads) {
      markLoginAlertsShown(user.id);
    }
  }, [
    enabled,
    user?.id,
    readyToEvaluate,
    dataLoading,
    hasTasks,
    hasNewLeads,
  ]);

  return {
    user,
    enabled,
    shouldOpen,
    tasks,
    newLeadsCount: extras.newLeadsCount,
    isLoading: dataLoading,
    refetch: async () => {
      await refetchTasks();
      await extrasQuery.refetch();
    },
  };
}
