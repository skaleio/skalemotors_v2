import type { CSSProperties } from "react";
import type { HeroProps } from "@/lib/website/sections";
import { isLuxuryTheme } from "@/lib/website/theme";

interface HeroBlockProps {
  props: HeroProps;
  siteName?: string | null;
  logoUrl?: string | null;
  theme?: string | null;
  whatsappPhone?: string | null;
  /** Vista previa del editor: altura acotada, sin vh de ventana completa. */
  preview?: boolean;
  /** Ancla del bloque de stock para el CTA. */
  stockHref?: string;
}

function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

export function HeroBlock({
  props,
  siteName,
  logoUrl,
  theme,
  whatsappPhone,
  preview = false,
  stockHref = "#stock",
}: HeroBlockProps) {
  const luxury = isLuxuryTheme(theme);

  const background = props.imageUrl
    ? `linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.2) 100%), url(${props.imageUrl}) center/cover no-repeat`
    : luxury
      ? `linear-gradient(160deg, #0a0a0a 0%, color-mix(in srgb, var(--sm-primary) 35%, #0a0a0a) 100%)`
      : `linear-gradient(135deg, var(--sm-primary), color-mix(in srgb, var(--sm-primary) 45%, #000))`;

  if (luxury) {
    const wa = waLink(whatsappPhone);
    const sectionClass = preview
      ? "relative flex min-h-[360px] flex-col justify-center overflow-visible px-4 py-12 md:px-8"
      : "relative flex min-h-[520px] flex-col justify-center overflow-visible px-4 py-20 md:min-h-[85svh] md:max-h-[900px] md:px-8 md:py-24";

    return (
      <section id="inicio" className={sectionClass} style={{ background }}>
        {/* Glow (recortado en capa aparte para no cortar el texto) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div
            className="sm-glow"
            style={{
              width: preview ? "70%" : "46vw",
              height: preview ? "70%" : "46vw",
              maxWidth: 620,
              maxHeight: 620,
              top: "-12%",
              right: "-6%",
              background:
                "radial-gradient(circle, color-mix(in srgb, var(--sm-primary) 70%, transparent), transparent 70%)",
            }}
          />
          <div
            className="sm-glow sm-d3"
            style={{
              width: preview ? "50%" : "30vw",
              height: preview ? "50%" : "30vw",
              maxWidth: 380,
              maxHeight: 380,
              bottom: "8%",
              left: "-8%",
              background:
                "radial-gradient(circle, color-mix(in srgb, var(--sm-secondary) 45%, transparent), transparent 70%)",
            }}
          />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={siteName ?? "Logo"}
              className="sm-fade-up mb-6 h-12 w-auto object-contain md:h-14"
            />
          ) : null}
          <p
            className="sm-fade-up mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/80"
            style={{
              fontFamily: "var(--sm-font-body)",
              borderColor: "rgba(255,255,255,0.16)",
              backgroundColor: "rgba(255,255,255,0.04)",
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "var(--sm-primary)" }}
            />
            {siteName ?? "Tu automotora"}
          </p>
          <h1
            className={`sm-fade-up sm-d1 max-w-4xl font-bold uppercase leading-[1.05] tracking-tight text-white ${
              preview ? "text-3xl sm:text-4xl" : "text-4xl md:text-6xl lg:text-7xl"
            }`}
            style={{ fontFamily: "var(--sm-font-heading)" }}
          >
            {props.title || "Encontrá tu próximo auto"}
          </h1>
          {props.subtitle ? (
            <p className="sm-fade-up sm-d2 mt-5 max-w-xl text-base text-white/80 md:text-lg">
              {props.subtitle}
            </p>
          ) : null}

          <div className="sm-fade-up sm-d3 mt-10 flex flex-wrap items-center gap-3">
            <a
              href={stockHref}
              className="sm-cta inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold uppercase tracking-wide"
              style={{
                backgroundColor: "var(--sm-primary)",
                color: "var(--sm-primary-fg)",
                borderRadius: "var(--sm-radius)",
              }}
            >
              {props.buttonText || "Ver vehículos"} →
            </a>
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="sm-cta inline-flex items-center justify-center px-7 py-3.5 text-sm font-medium text-white"
                style={{
                  border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: "var(--sm-radius)",
                }}
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        </div>

        {/* Indicador de scroll (solo sitio público) */}
        {!preview ? (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 md:block">
          <div
            className="flex h-9 w-5 items-start justify-center rounded-full border pt-1.5"
            style={{ borderColor: "rgba(255,255,255,0.3)" }}
          >
            <span className="sm-scroll-cue h-1.5 w-1 rounded-full bg-white/70" />
          </div>
        </div>
        ) : null}
      </section>
    );
  }

  const sectionStyle: CSSProperties = {
    background,
    paddingTop: "var(--sm-space-section)",
    paddingBottom: "var(--sm-space-section)",
  };

  return (
    <section
      className="relative flex min-h-[360px] flex-col items-center justify-center px-6 text-center"
      style={sectionStyle}
    >
      <div className="max-w-2xl text-white">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={siteName ?? "Logo"}
            className="mx-auto mb-5 h-14 w-auto object-contain"
          />
        ) : siteName ? (
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/80">
            {siteName}
          </p>
        ) : null}

        <h1
          className="text-3xl font-bold leading-tight md:text-5xl"
          style={{ fontFamily: "var(--sm-font-heading)" }}
        >
          {props.title || "Título principal"}
        </h1>

        <span
          className="mx-auto mt-4 block h-1 w-16 rounded-full"
          style={{ backgroundColor: "var(--sm-secondary)" }}
        />

        {props.subtitle ? (
          <p className="mt-4 text-base text-white/85 md:text-lg">{props.subtitle}</p>
        ) : null}

        {props.buttonText ? (
          <a
            href={stockHref}
            className="mt-7 inline-block px-6 py-2.5 text-sm font-semibold shadow-lg"
            style={{
              backgroundColor: "var(--sm-bg)",
              color: "var(--sm-fg)",
              borderRadius: "var(--sm-radius)",
            }}
          >
            {props.buttonText}
          </a>
        ) : null}
      </div>
    </section>
  );
}
