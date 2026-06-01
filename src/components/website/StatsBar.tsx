import { Car, MapPin, Star, Users } from "lucide-react";

interface StatItem {
  icon: typeof Car;
  value: string;
  label: string;
}

interface StatsBarProps {
  vehicleCount?: number;
}

/** Banda de métricas (estilo Roadify), solo en temas luxury. */
export function StatsBar({ vehicleCount }: StatsBarProps) {
  const stats: StatItem[] = [
    { icon: Car, value: vehicleCount && vehicleCount > 0 ? `${vehicleCount}+` : "Stock", label: "Vehículos disponibles" },
    { icon: Users, value: "+1.200", label: "Clientes felices" },
    { icon: MapPin, value: "Chile", label: "Entrega y transferencia" },
    { icon: Star, value: "4.9/5", label: "Satisfacción" },
  ];

  return (
    <section
      className="px-4 md:px-6"
      style={{
        paddingTop: "calc(var(--sm-space-section) * 0.6)",
        paddingBottom: "calc(var(--sm-space-section) * 0.6)",
        backgroundColor: "color-mix(in srgb, var(--sm-surface) 92%, var(--sm-bg))",
        borderTop: "1px solid var(--sm-border)",
        borderBottom: "1px solid var(--sm-border)",
      }}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 md:grid-cols-4">
        {stats.map(({ icon: Icon, value, label }, i) => (
          <div
            key={label}
            className={`sm-fade-up ${["sm-d1", "sm-d2", "sm-d3", "sm-d4"][i]} flex items-center gap-3`}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
              style={{
                backgroundColor: "color-mix(in srgb, var(--sm-primary) 16%, transparent)",
                color: "var(--sm-primary)",
              }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p
                className="text-xl font-bold leading-none md:text-2xl"
                style={{ color: "var(--sm-fg)", fontFamily: "var(--sm-font-heading)" }}
              >
                {value}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--sm-muted)" }}>
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
