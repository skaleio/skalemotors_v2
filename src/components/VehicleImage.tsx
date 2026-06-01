import { memo, useMemo, type ImgHTMLAttributes } from "react";
import { toSupabaseTransformedImageUrl } from "@/lib/storage-image-utils";

const PLACEHOLDER = "/placeholder.svg";

export type VehicleImagePreset = "thumb-xs" | "thumb-sm" | "card" | "hero";

interface PresetConfig {
  transformWidth: number;
  transformHeight: number;
  quality: number;
  sizes: string;
  loading: "lazy" | "eager";
  fetchPriority: "low" | "auto" | "high";
}

const PRESETS: Record<VehicleImagePreset, PresetConfig> = {
  "thumb-xs": { transformWidth: 96,   transformHeight: 96,  quality: 68, sizes: "48px",  loading: "lazy",  fetchPriority: "low" },
  "thumb-sm": { transformWidth: 256,  transformHeight: 192, quality: 70, sizes: "128px", loading: "lazy",  fetchPriority: "low" },
  "card":     { transformWidth: 640,  transformHeight: 480, quality: 74, sizes: "320px", loading: "lazy",  fetchPriority: "auto" },
  "hero":     { transformWidth: 1200, transformHeight: 720, quality: 80, sizes: "(min-width:1024px) 800px, 100vw", loading: "eager", fetchPriority: "high" },
};

type VehicleImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "loading" | "decoding" | "fetchPriority" | "sizes" | "width" | "height"
> & {
  src: string | null | undefined;
  alt: string;
  preset: VehicleImagePreset;
  loading?: "lazy" | "eager";
  fetchPriority?: "low" | "auto" | "high";
  /** Píxeles que ocupa visualmente — anti-CLS. */
  displayWidth?: number;
  displayHeight?: number;
  /** Forzar a no transformar (URLs locales/data ya se detectan automáticamente). */
  disableTransform?: boolean;
  fallback?: string;
  resize?: "cover" | "contain";
};

function normalizeUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith("blob:") || s.startsWith("data:")) return s;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://localhost";
    const u = new URL(s, base);
    if (u.protocol === "http:") u.protocol = "https:";
    return u.toString();
  } catch {
    return s || null;
  }
}

export const VehicleImage = memo(function VehicleImage({
  src,
  alt,
  preset,
  className,
  loading,
  fetchPriority,
  displayWidth,
  displayHeight,
  disableTransform,
  fallback = PLACEHOLDER,
  resize = "cover",
  onError,
  ...rest
}: VehicleImageProps) {
  const resolvedPreset: VehicleImagePreset =
    preset && preset in PRESETS ? preset : "thumb-sm";
  const cfg = PRESETS[resolvedPreset];
  const { initialSrc, rawUrl } = useMemo(() => {
    const normalized = normalizeUrl(src);
    if (!normalized) return { initialSrc: fallback, rawUrl: null as string | null };
    if (disableTransform || normalized.startsWith("blob:") || normalized.startsWith("data:")) {
      return { initialSrc: normalized, rawUrl: null };
    }
    const transformed = toSupabaseTransformedImageUrl(normalized, {
      width: cfg.transformWidth,
      height: cfg.transformHeight,
      quality: cfg.quality,
      resize,
    });
    return { initialSrc: transformed ?? normalized, rawUrl: transformed ? normalized : null };
  }, [src, fallback, disableTransform, cfg.transformWidth, cfg.transformHeight, cfg.quality, resize]);

  return (
    <img
      {...rest}
      src={initialSrc}
      alt={alt}
      className={className}
      loading={loading ?? cfg.loading}
      decoding="async"
      fetchPriority={fetchPriority ?? cfg.fetchPriority}
      sizes={cfg.sizes}
      width={displayWidth}
      height={displayHeight}
      onError={(e) => {
        const el = e.currentTarget;
        const stage = el.dataset.imgFallbackStage ?? "0";
        if (stage === "0" && rawUrl) {
          el.dataset.imgFallbackStage = "1";
          el.src = rawUrl;
        } else if (stage !== "2") {
          el.dataset.imgFallbackStage = "2";
          el.src = fallback;
        }
        onError?.(e);
      }}
    />
  );
});
