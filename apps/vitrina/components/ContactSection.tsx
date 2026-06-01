import { LeadForm } from "./LeadForm";

interface ContactSectionProps {
  host: string;
  siteName: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export function ContactSection({
  host,
  siteName,
  whatsapp,
  phone,
  email,
  address,
}: ContactSectionProps) {
  const waDigits = whatsapp?.replace(/[^\d]/g, "");

  return (
    <section
      className="px-6"
      style={{
        paddingTop: "var(--sm-space-section)",
        paddingBottom: "var(--sm-space-section)",
        backgroundColor: "var(--sm-surface)",
      }}
    >
      <h2
        className="mb-6 text-center text-2xl font-bold"
        style={{ fontFamily: "var(--sm-font-heading)", color: "var(--sm-fg)" }}
      >
        Contacto
      </h2>
      <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
        <div className="space-y-2 text-sm" style={{ color: "var(--sm-muted)" }}>
          {siteName ? <p className="font-semibold" style={{ color: "var(--sm-fg)" }}>{siteName}</p> : null}
          {address ? <p>{address}</p> : null}
          {phone ? <p>Tel: {phone}</p> : null}
          {email ? <p>Email: {email}</p> : null}
          {waDigits ? (
            <a
              href={`https://wa.me/${waDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-medium"
              style={{ color: "var(--sm-primary)" }}
            >
              WhatsApp
            </a>
          ) : null}
        </div>
        <LeadForm host={host} />
      </div>
    </section>
  );
}
