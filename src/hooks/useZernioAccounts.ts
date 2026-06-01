import {
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { ZernioScope } from "@/lib/zernio/rbac";
import {
  listZernioAccountsFromDb,
  listZernioPostsFromDb,
} from "@/lib/services/zernioAccounts";
import type { ZernioAccountRow, ZernioPostRow } from "@/lib/services/zernioApi";

const STALE_MS = 5 * 60 * 1000;
const GC_MS = 15 * 60 * 1000;

export const zernioAccountsQueryKey = (scope: ZernioScope) => ["zernio-accounts", scope] as const;

export const zernioPostsQueryKey = (scope: ZernioScope) => ["zernio-posts", scope] as const;

export function zernioAccountsQueryOptions(scope: ZernioScope) {
  return {
    queryKey: zernioAccountsQueryKey(scope),
    queryFn: () => listZernioAccountsFromDb(scope),
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: 1,
    refetchOnWindowFocus: false,
  };
}

export function zernioPostsQueryOptions(scope: ZernioScope, enabled = true) {
  return {
    queryKey: zernioPostsQueryKey(scope),
    queryFn: () => listZernioPostsFromDb(scope),
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled,
  };
}

export function prefetchZernioAccounts(queryClient: QueryClient, scopes: ZernioScope[]) {
  void import("@/pages/RedesSociales");
  for (const scope of scopes) {
    void queryClient.prefetchQuery(zernioAccountsQueryOptions(scope));
  }
}

export function useZernioAccounts(scope: ZernioScope): UseQueryResult<ZernioAccountRow[], Error> {
  return useQuery(zernioAccountsQueryOptions(scope));
}

export function useZernioPosts(
  scope: ZernioScope,
  enabled: boolean,
): UseQueryResult<ZernioPostRow[], Error> {
  return useQuery(zernioPostsQueryOptions(scope, enabled));
}
