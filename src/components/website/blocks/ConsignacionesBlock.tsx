import { Handshake } from "lucide-react";
import type { ConsignacionesProps } from "@/lib/website/sections";

interface ConsignacionesBlockProps {
  props: ConsignacionesProps;
  anchorId: string;
  whatsappPhone?: string | null;
}

function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

export function ConsignacionesBlock({
  props,
  anchorId,
  whatsappPhone,
}: ConsignacionesBlockProps) {
  const wa = waLink(whatsappPhone);

  return (
    <section
      id={anchorId}
      className="px-4 md:px-6"
      style={{
        paddingTop: "var(--sm-space-section)",
        paddingBottom: "var(--sm-space-section)",
      }}
    >
      <div
        className="mx-auto flex max-w-5xl flex-col gap-8 rounded-2xl border p-8 md:flex-row md:items-center md:p-10"
        style={{
          borderColor: "var(--sm-border)",
          backgroundColor: "color-mix(in srgb, var(--sm-surface) 85%, var(--sm-bg))",
        }}
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: "color-mix(in srgb, var(--sm-primary) 18%, transparent)",
            color: "var(--sm-primary)",
          }}
        >
          <Handshake className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-semibold uppercase tracking-[0.3em]"
            style={{ color: "var(--sm-primary)" }}
          >
            {props.subtitle}
          </p>
          <h2
            className="mt-2 text-2xl font-bold md:text-3xl"
            style={{ color: "var(--sm-fg)", fontFamily: "var(--sm-font-heading)" }}
          >
            {props.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed md:text-base" style={{ color: "var(--sm-muted)" }}>
            {props.description}
          </p>
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="sm-cta mt-6 inline-flex items-center justify-center px-6 py-3 text-sm font-semibold"
              style={{
                backgroundColor: "var(--sm-primary)",
                color: "var(--sm-primary-fg)",
                borderRadius: "var(--sm-radius)",
              }}
            >
              {props.buttonText || "Consultar"} →
            </a>
          ) : (
            <a
              href="#contacto"
              className="sm-cta mt-6 inline-flex items-center justify-center px-6 py-3 text-sm font-semibold"
              style={{
                backgroundColor: "var(--sm-primary)",
                color: "var(--sm-primary-fg)",
                borderRadius: "var(--sm-radius)",
              }}
            >
              {props.buttonText || "Consultar"} →
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
