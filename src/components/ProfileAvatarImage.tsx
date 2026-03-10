import { useCallback, useEffect, useMemo, useState } from "react";
import { AvatarImage } from "@/components/ui/avatar";
import { getOptimizedAvatarUrl } from "@/lib/avatar-utils";

const DEFAULT_SIZE = 64;

type ProfileAvatarImageProps = React.ComponentPropsWithoutRef<typeof AvatarImage> & {
  /** URL original del avatar (ej. desde user.avatar_url) */
  avatarUrl: string | undefined | null;
  /** Tamaño en px para la URL transformada (sidebar/topbar: 64, settings: 96 o 160) */
  size?: number;
  /** Valor que cambia cuando la imagen se actualiza (ej. user.updated_at) para evitar caché */
  cacheKey?: string | null;
};

/**
 * Imagen de avatar optimizada: intenta cargar la versión transformada (más ligera).
 * Incluye decoding async. No pasamos fetchPriority al DOM para evitar warning en React 18.
 */
export function ProfileAvatarImage({
  avatarUrl,
  size = DEFAULT_SIZE,
  cacheKey,
  decoding = "async",
  fetchPriority,
  ...props
}: ProfileAvatarImageProps) {
  const optimizedUrl = useMemo(
    () => getOptimizedAvatarUrl(avatarUrl, size, cacheKey),
    [avatarUrl, size, cacheKey]
  );
  const effectiveUrl = optimizedUrl ?? avatarUrl ?? undefined;
  const [src, setSrc] = useState<string | undefined>(effectiveUrl);

  useEffect(() => {
    setSrc(effectiveUrl);
  }, [effectiveUrl]);

  const handleError = useCallback(() => {
    if (avatarUrl && optimizedUrl && src === optimizedUrl) {
      setSrc(avatarUrl);
    }
  }, [avatarUrl, optimizedUrl, src]);

  return (
    <AvatarImage
      key={avatarUrl ?? "no-avatar"}
      src={src}
      alt=""
      decoding={decoding}
      onError={handleError}
      className="object-cover"
      {...props}
    />
  );
}
