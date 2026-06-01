import { CheckCircle2 } from "lucide-react";
import type { VendeTuAutoProps } from "@/lib/website/sections";

interface VendeTuAutoBlockProps {
  props: VendeTuAutoProps;
  anchorId: string;
  whatsappPhone?: string | null;
}

function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

export function VendeTuAutoBlock({
  props,
  anchorId,
  whatsappPhone,
}: VendeTuAutoBlockProps) {
  const wa = waLink(whatsappPhone);
  const benefits = props.benefits?.length ? props.benefits : [];

  return (
    <section
      id={anchorId}
      className="px-4 md:px-6"
      style={{
        paddingTop: "var(--sm-space-section)",
        paddingBottom: "var(--sm-space-section)",
        background: `linear-gradient(180deg, var(--sm-bg) 0%, color-mix(in srgb, var(--sm-primary) 12%, var(--sm-bg)) 100%)`,
      }}
    >
      <div className="mx-auto max-w-3xl text-center">
        <p
          className="text-xs font-semibold uppercase tracking-[0.3em]"
          style={{ color: "var(--sm-primary)" }}
        >
          {props.subtitle}
        </p>
        <h2
          className="mt-2 text-2xl font-bold md:text-4xl"
          style={{ color: "var(--sm-fg)", fontFamily: "var(--sm-font-heading)" }}
        >
          {props.title}
        </h2>
        {benefits.length > 0 ? (
          <ul className="mt-8 space-y-3 text-left">
            {benefits.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
                style={{ borderColor: "var(--sm-border)", color: "var(--sm-fg)" }}
              >
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0"
                  style={{ color: "var(--sm-primary)" }}
                />
                {b}
              </li>
            ))}
          </ul>
        ) : null}
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="sm-cta mt-8 inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: "var(--sm-primary)",
              color: "var(--sm-primary-fg)",
              borderRadius: "var(--sm-radius)",
            }}
          >
            {props.buttonText || "Contactar"} →
          </a>
        ) : null}
      </div>
    </section>
  );
}
