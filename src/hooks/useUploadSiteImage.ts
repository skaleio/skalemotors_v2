import { useMutation } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { siteAssetsService } from "@/lib/services/siteAssets";

/**
 * Sube una imagen de la vitrina al espacio del tenant actual.
 * El tenant_id sale de useAuth (con fallback al RPC dentro del servicio).
 */
export function useUploadSiteImage() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: (file: File) => siteAssetsService.uploadImage(file, user?.tenant_id),
  });
}
