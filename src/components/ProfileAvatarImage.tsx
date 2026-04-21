import { useCallback, useEffect, useMemo, useState } from "react";
import { AvatarImage } from "@/components/ui/avatar";
import { getAvatarSrcSet, getOptimizedAvatarUrl } from "@/lib/avatar-utils";

const DEFAULT_SIZE = 64;

type ProfileAvatarImageProps = Omit<React.ComponentPropsWithoutRef<typeof AvatarImage>, "src" | "srcSet"> & {
  avatarUrl: string | undefined | null;
  /** Tamaño CSS en px (se sirve 1x y 2x via srcSet automáticamente) */
  size?: number;
  /** Invalidador de caché cuando la imagen cambia (ej. user.updated_at) */
  cacheKey?: string | null;
  /**
   * "eager" + fetchPriority="high" para avatares above-the-fold (TopBar).
   * "lazy" (default) para avatares fuera de pantalla (listas, detalles).
   */
  priority?: "high" | "low";
};

/**
 * Imagen de avatar optimizada:
 * - srcSet 1x/2x para pantallas retina sin ver borroso
 * - WebP nativo via transform de Supabase Storage (~30% menos peso vs JPEG)
 * - width/height explícitos → sin layout shift
 * - fetchPriority="high" + loading="eager" para el del TopBar (LCP)
 * - Fallback automático a la URL original si la transformada falla
 */
export function ProfileAvatarImage({
  avatarUrl,
  size = DEFAULT_SIZE,
  cacheKey,
  priority = "low",
  decoding = "async",
  ...props
}: ProfileAvatarImageProps) {
  const optimizedUrl = useMemo(
    () => getOptimizedAvatarUrl(avatarUrl, size, cacheKey),
    [avatarUrl, size, cacheKey]
  );
  const srcSet = useMemo(
    () => getAvatarSrcSet(avatarUrl, size, cacheKey),
    [avatarUrl, size, cacheKey]
  );
  const effectiveUrl = optimizedUrl ?? avatarUrl ?? undefined;
  const [src, setSrc] = useState<string | undefined>(effectiveUrl);
  const [useSrcSet, setUseSrcSet] = useState<boolean>(!!srcSet);

  useEffect(() => {
    setSrc(effectiveUrl);
    setUseSrcSet(!!srcSet);
  }, [effectiveUrl, srcSet]);

  // Si falla la URL transformada, caer a la original sin srcSet
  const handleError = useCallback(() => {
    if (avatarUrl && optimizedUrl && src === optimizedUrl) {
      setSrc(avatarUrl);
      setUseSrcSet(false);
    }
  }, [avatarUrl, optimizedUrl, src]);

  return (
    <AvatarImage
      key={avatarUrl ?? "no-avatar"}
      src={src}
      srcSet={useSrcSet ? srcSet : undefined}
      width={size}
      height={size}
      alt=""
      decoding={decoding}
      loading={priority === "high" ? "eager" : "lazy"}
      fetchPriority={priority === "high" ? "high" : "auto"}
      onError={handleError}
      className="object-cover"
      {...props}
    />
  );
}
