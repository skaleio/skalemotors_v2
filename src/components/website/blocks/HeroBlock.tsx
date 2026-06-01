import type { CSSProperties } from "react";
import type { HeroProps } from "@/lib/website/sections";
import { getThemeLayout, isThemeId, type ThemeId } from "@/lib/website/theme";

interface HeroBlockProps {
  props: HeroProps;
  siteName?: string | null;
  logoUrl?: string | null;
  theme?: string | null;
  whatsappPhone?: string | null;
  preview?: boolean;
  stockHref?: string;
}

function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

function HeroLuxury({
  props,
  siteName,
  logoUrl,
  whatsappPhone,
  preview,
  stockHref,
  themeId,
  background,
}: {
  props: HeroProps;
  siteName?: string | null;
  logoUrl?: string | null;
  whatsappPhone?: string | null;
  preview: boolean;
  stockHref: string;
  themeId: ThemeId;
  background: string;
}) {
  const wa = waLink(whatsappPhone);
  const sectionClass = preview
    ? "relative flex min-h-[360px] flex-col justify-center overflow-visible px-4 py-12 md:px-8"
    : "relative flex min-h-[520px] flex-col justify-center overflow-visible px-4 py-20 md:min-h-[85svh] md:max-h-[900px] md:px-8 md:py-24";

  return (
    <section id="inicio" className={sectionClass} style={{ background }}>
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
        {themeId === "miami" ? (
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
        ) : null}
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

function HeroModern({
  props,
  siteName,
  whatsappPhone,
  preview,
  stockHref,
  background,
}: {
  props: HeroProps;
  siteName?: string | null;
  whatsappPhone?: string | null;
  preview: boolean;
  stockHref: string;
  background: string;
}) {
  const wa = waLink(whatsappPhone);
  const minH = preview ? "min-h-[340px]" : "min-h-[480px] md:min-h-[72vh]";

  return (
    <section
      id="inicio"
      className={`relative overflow-hidden px-4 py-12 md:px-8 md:py-16 ${minH}`}
      style={{ backgroundColor: "var(--sm-bg)" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 100% 0%, color-mix(in srgb, var(--sm-primary) 25%, transparent), transparent)",
        }}
      />
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
        <div>
          {siteName ? (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--sm-primary)" }}>
              {siteName}
            </p>
          ) : null}
          <h1
            className="text-3xl font-bold leading-tight md:text-5xl"
            style={{ color: "var(--sm-fg)", fontFamily: "var(--sm-font-heading)" }}
          >
            {props.title || "Encontrá tu próximo auto"}
          </h1>
          {props.subtitle ? (
            <p className="mt-4 text-base md:text-lg" style={{ color: "var(--sm-muted)" }}>
              {props.subtitle}
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={stockHref}
              className="inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold shadow-md"
              style={{
                backgroundColor: "var(--sm-primary)",
                color: "var(--sm-primary-fg)",
              }}
            >
              {props.buttonText || "Ver vehículos"}
            </a>
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border px-6 py-3 text-sm font-medium"
                style={{ borderColor: "var(--sm-border)", color: "var(--sm-fg)" }}
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        </div>
        <div
          className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-lg md:aspect-auto md:min-h-[280px]"
          style={{
            background: props.imageUrl
              ? `url(${props.imageUrl}) center/cover no-repeat`
              : background,
            borderRadius: "var(--sm-radius)",
          }}
        />
      </div>
    </section>
  );
}

function HeroClassic({
  props,
  siteName,
  whatsappPhone,
  preview,
  stockHref,
}: {
  props: HeroProps;
  siteName?: string | null;
  whatsappPhone?: string | null;
  preview: boolean;
  stockHref: string;
}) {
  const wa = waLink(whatsappPhone);

  return (
    <section
      id="inicio"
      className={`border-b px-4 md:px-10 ${preview ? "py-12" : "py-16 md:py-20"}`}
      style={{
        backgroundColor: "var(--sm-surface)",
        borderColor: "var(--sm-border)",
      }}
    >
      <div className="mx-auto max-w-3xl">
        {siteName ? (
          <p
            className="mb-4 text-sm italic"
            style={{ color: "var(--sm-muted)", fontFamily: "var(--sm-font-body)" }}
          >
            {siteName}
          </p>
        ) : null}
        <h1
          className="text-3xl font-semibold leading-snug md:text-5xl"
          style={{ color: "var(--sm-fg)", fontFamily: "var(--sm-font-heading)" }}
        >
          {props.title || "Su próximo vehículo, con confianza"}
        </h1>
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1" style={{ backgroundColor: "var(--sm-border)" }} />
          <span className="h-2 w-2 rotate-45" style={{ backgroundColor: "var(--sm-primary)" }} />
          <span className="h-px flex-1" style={{ backgroundColor: "var(--sm-border)" }} />
        </div>
        {props.subtitle ? (
          <p className="text-lg leading-relaxed" style={{ color: "var(--sm-muted)" }}>
            {props.subtitle}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-4">
          <a
            href={stockHref}
            className="inline-flex border-2 px-6 py-2.5 text-sm font-medium tracking-wide"
            style={{
              borderColor: "var(--sm-primary)",
              color: "var(--sm-primary)",
              borderRadius: "var(--sm-radius)",
            }}
          >
            {props.buttonText || "Ver catálogo"}
          </a>
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm underline-offset-4 hover:underline"
              style={{ color: "var(--sm-muted)" }}
            >
              Escribinos por WhatsApp
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
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
  const layout = getThemeLayout(theme);
  const themeId: ThemeId = isThemeId(theme) ? theme : "moderna";

  const imageBg = props.imageUrl
    ? `linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.25) 100%), url(${props.imageUrl}) center/cover no-repeat`
    : null;

  const luxuryBg =
    imageBg ??
    (themeId === "premium"
      ? `linear-gradient(160deg, #0b0b0f 0%, color-mix(in srgb, var(--sm-primary) 28%, #0b0b0f) 100%)`
      : `linear-gradient(160deg, #0a0a0a 0%, color-mix(in srgb, var(--sm-primary) 35%, #0a0a0a) 100%)`);

  const modernAccentBg = `linear-gradient(135deg, color-mix(in srgb, var(--sm-primary) 15%, var(--sm-surface)), var(--sm-surface))`;

  if (layout === "luxury") {
    return (
      <HeroLuxury
        props={props}
        siteName={siteName}
        logoUrl={logoUrl}
        whatsappPhone={whatsappPhone}
        preview={preview}
        stockHref={stockHref}
        themeId={themeId}
        background={luxuryBg}
      />
    );
  }

  if (layout === "classic") {
    return (
      <HeroClassic
        props={props}
        siteName={siteName}
        whatsappPhone={whatsappPhone}
        preview={preview}
        stockHref={stockHref}
      />
    );
  }

  return (
    <HeroModern
      props={props}
      siteName={siteName}
      whatsappPhone={whatsappPhone}
      preview={preview}
      stockHref={stockHref}
      background={modernAccentBg}
    />
  );
}
