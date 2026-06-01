import type { ReactNode } from "react";
import type { ContactoProps } from "@/lib/website/sections";

export interface SiteContactInfo {
  siteName?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

interface ContactBlockProps {
  props: ContactoProps;
  anchorId: string;
  contact: SiteContactInfo;
  preview?: boolean;
  /** Formulario real (vitrina pública). */
  formNode?: ReactNode;
}

function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

export function ContactBlock({
  props,
  anchorId,
  contact,
  preview = false,
  formNode,
}: ContactBlockProps) {
  const wa = waLink(contact.whatsapp);

  return (
    <section
      id={anchorId}
      className="px-4 md:px-6"
      style={{
        paddingTop: "var(--sm-space-section)",
        paddingBottom: "var(--sm-space-section)",
        backgroundColor: "var(--sm-surface)",
      }}
    >
      <div className="mx-auto max-w-4xl text-center">
        <p
          className="text-xs font-semibold uppercase tracking-[0.3em]"
          style={{ color: "var(--sm-primary)" }}
        >
          Hablemos
        </p>
        <h2
          className="mt-2 text-2xl font-bold md:text-3xl"
          style={{ color: "var(--sm-fg)", fontFamily: "var(--sm-font-heading)" }}
        >
          {props.title || "Contacto"}
        </h2>
        {props.subtitle ? (
          <p className="mt-3 text-sm md:text-base" style={{ color: "var(--sm-muted)" }}>
            {props.subtitle}
          </p>
        ) : null}
      </div>

      <div className="mx-auto mt-8 grid max-w-4xl gap-8 md:grid-cols-2">
        <div className="space-y-2 text-sm" style={{ color: "var(--sm-muted)" }}>
          {contact.siteName ? (
            <p className="font-semibold" style={{ color: "var(--sm-fg)" }}>
              {contact.siteName}
            </p>
          ) : null}
          {contact.address ? <p>{contact.address}</p> : null}
          {contact.phone ? <p>Tel: {contact.phone}</p> : null}
          {contact.email ? <p>Email: {contact.email}</p> : null}
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-medium"
              style={{ color: "var(--sm-primary)" }}
            >
              WhatsApp
            </a>
          ) : null}
        </div>
        {formNode ?? (
          <div
            className="rounded-xl border p-6 text-center text-sm"
            style={{ borderColor: "var(--sm-border)", color: "var(--sm-muted)" }}
          >
            {preview ? (
              <p>Formulario de contacto activo en tu web publicada.</p>
            ) : (
              <p>Completá el formulario en la versión publicada del sitio.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
