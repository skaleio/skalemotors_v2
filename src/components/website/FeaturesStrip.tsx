import { Car, Headphones, ShieldCheck, Sparkles } from "lucide-react";

const ITEMS = [
  { icon: Car, label: "Stock verificado", sub: "Autos revisados antes de publicar" },
  { icon: ShieldCheck, label: "Compra segura", sub: "Documentación y respaldo" },
  { icon: Headphones, label: "Asesoría directa", sub: "Te acompañamos en cada paso" },
  { icon: Sparkles, label: "Financiamiento", sub: "Opciones según tu perfil" },
];

/** Barra de beneficios (estilo Roadify), solo en temas luxury. */
export function FeaturesStrip() {
  return (
    <section
      className="border-y px-4 py-8 md:px-6"
      style={{
        borderColor: "var(--sm-border)",
        backgroundColor: "color-mix(in srgb, var(--sm-surface) 90%, var(--sm-bg))",
      }}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 md:grid-cols-4 md:gap-4">
        {ITEMS.map(({ icon: Icon, label, sub }, i) => (
          <div
            key={label}
            className={`sm-fade-up ${["sm-d1", "sm-d2", "sm-d3", "sm-d4"][i]} group flex flex-col items-center text-center md:items-start md:text-left`}
          >
            <div
              className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
              style={{
                backgroundColor: "color-mix(in srgb, var(--sm-primary) 18%, transparent)",
                color: "var(--sm-primary)",
              }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold" style={{ color: "var(--sm-fg)" }}>
              {label}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--sm-muted)" }}>
              {sub}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
