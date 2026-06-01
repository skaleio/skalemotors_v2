// Modelo de secciones del editor visual de la vitrina (tipo Shopify).
// Las secciones se guardan como un array ordenado en tenant_sites.sections (jsonb).

export type SectionType =
  | "hero"
  | "vehiculos"
  | "contacto"
  | "consignaciones"
  | "vende_tu_auto";

export interface HeroProps {
  title: string;
  subtitle: string;
  imageUrl: string;
  buttonText: string;
}

export interface VehiculosProps {
  title: string;
  limit: number;
}

export interface ContactoProps {
  title: string;
  subtitle: string;
}

export interface ConsignacionesProps {
  title: string;
  subtitle: string;
  description: string;
  buttonText: string;
}

export interface VendeTuAutoProps {
  title: string;
  subtitle: string;
  buttonText: string;
  /** Beneficios en lista (máx. 4 en UI). */
  benefits: string[];
}

export type SectionProps =
  | HeroProps
  | VehiculosProps
  | ContactoProps
  | ConsignacionesProps
  | VendeTuAutoProps;

export interface SectionBlock {
  id: string;
  type: SectionType;
  visible: boolean;
  props: SectionProps;
  /** Texto en el menú superior; vacío = etiqueta por defecto del tipo. */
  navLabel?: string;
  /** Si aparece en el header. Por defecto según tipo. */
  showInNav?: boolean;
}

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: "Portada",
  vehiculos: "Vehículos",
  contacto: "Contacto",
  consignaciones: "Consignaciones",
  vende_tu_auto: "Vende tu auto",
};

const SECTION_TYPES: SectionType[] = [
  "hero",
  "vehiculos",
  "contacto",
  "consignaciones",
  "vende_tu_auto",
];

const ANCHOR_BY_TYPE: Record<SectionType, string> = {
  hero: "inicio",
  vehiculos: "stock",
  contacto: "contacto",
  consignaciones: "consignaciones",
  vende_tu_auto: "vende-tu-auto",
};

export function getSectionAnchor(section: SectionBlock): string {
  return ANCHOR_BY_TYPE[section.type] ?? section.id;
}

function uid(): string {
  return `s_${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultHeroProps(): HeroProps {
  return {
    title: "Encontrá tu próximo auto",
    subtitle: "Stock disponible con financiamiento y garantía.",
    imageUrl: "",
    buttonText: "Ver vehículos",
  };
}

export function defaultVehiculosProps(): VehiculosProps {
  return { title: "Nuestro stock", limit: 12 };
}

export function defaultContactoProps(): ContactoProps {
  return {
    title: "Contacto",
    subtitle: "Escribinos o llamanos. Te respondemos a la brevedad.",
  };
}

export function defaultConsignacionesProps(): ConsignacionesProps {
  return {
    title: "Consignaciones",
    subtitle: "Dejá tu auto con nosotros",
    description:
      "Publicamos tu vehículo, gestionamos visitas y negociamos por vos. Transparencia en cada paso.",
    buttonText: "Consultar consignación",
  };
}

export function defaultVendeTuAutoProps(): VendeTuAutoProps {
  return {
    title: "Vende tu auto",
    subtitle: "Tasación rápida y pago seguro",
    buttonText: "Quiero vender mi auto",
    benefits: [
      "Tasación sin compromiso",
      "Transferencia asistida",
      "Pago ágil y documentación en regla",
    ],
  };
}

function defaultPropsFor(type: SectionType): SectionProps {
  switch (type) {
    case "hero":
      return defaultHeroProps();
    case "vehiculos":
      return defaultVehiculosProps();
    case "contacto":
      return defaultContactoProps();
    case "consignaciones":
      return defaultConsignacionesProps();
    case "vende_tu_auto":
      return defaultVendeTuAutoProps();
  }
}

export function createSection(type: SectionType): SectionBlock {
  return {
    id: uid(),
    type,
    visible: true,
    props: defaultPropsFor(type),
  };
}

export function defaultSections(): SectionBlock[] {
  return [
    createSection("hero"),
    createSection("vehiculos"),
    createSection("contacto"),
  ];
}

function isSectionType(value: unknown): value is SectionType {
  return typeof value === "string" && SECTION_TYPES.includes(value as SectionType);
}

function normalizeProps(type: SectionType, raw: unknown): SectionProps {
  const base = defaultPropsFor(type);
  if (!raw || typeof raw !== "object") return base;
  const p = raw as Record<string, unknown>;
  switch (type) {
    case "hero":
      return {
        title: typeof p.title === "string" ? p.title : base.title,
        subtitle: typeof p.subtitle === "string" ? p.subtitle : (base as HeroProps).subtitle,
        imageUrl: typeof p.imageUrl === "string" ? p.imageUrl : (base as HeroProps).imageUrl,
        buttonText:
          typeof p.buttonText === "string" ? p.buttonText : (base as HeroProps).buttonText,
      };
    case "vehiculos":
      return {
        title: typeof p.title === "string" ? p.title : (base as VehiculosProps).title,
        limit:
          typeof p.limit === "number" && p.limit > 0
            ? Math.min(48, Math.floor(p.limit))
            : (base as VehiculosProps).limit,
      };
    case "contacto":
      return {
        title: typeof p.title === "string" ? p.title : (base as ContactoProps).title,
        subtitle:
          typeof p.subtitle === "string" ? p.subtitle : (base as ContactoProps).subtitle,
      };
    case "consignaciones":
      return {
        title: typeof p.title === "string" ? p.title : (base as ConsignacionesProps).title,
        subtitle:
          typeof p.subtitle === "string" ? p.subtitle : (base as ConsignacionesProps).subtitle,
        description:
          typeof p.description === "string"
            ? p.description
            : (base as ConsignacionesProps).description,
        buttonText:
          typeof p.buttonText === "string"
            ? p.buttonText
            : (base as ConsignacionesProps).buttonText,
      };
    case "vende_tu_auto": {
      const b = base as VendeTuAutoProps;
      const benefits = Array.isArray(p.benefits)
        ? p.benefits.filter((x): x is string => typeof x === "string").slice(0, 4)
        : b.benefits;
      return {
        title: typeof p.title === "string" ? p.title : b.title,
        subtitle: typeof p.subtitle === "string" ? p.subtitle : b.subtitle,
        buttonText: typeof p.buttonText === "string" ? p.buttonText : b.buttonText,
        benefits: benefits.length ? benefits : b.benefits,
      };
    }
  }
}

/**
 * Normaliza tenant_sites.sections (array, legacy toggles u otro) a SectionBlock[].
 */
export function coerceSections(raw: unknown): SectionBlock[] {
  if (!Array.isArray(raw)) return defaultSections();
  const valid: SectionBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as SectionBlock;
    if (!isSectionType(s.type)) continue;
    valid.push({
      id: typeof s.id === "string" && s.id ? s.id : uid(),
      type: s.type,
      visible: s.visible !== false,
      props: normalizeProps(s.type, s.props),
      navLabel: typeof s.navLabel === "string" ? s.navLabel : undefined,
      showInNav: typeof s.showInNav === "boolean" ? s.showInNav : undefined,
    });
  }
  return valid.length ? valid : defaultSections();
}

/** Solo una portada por sitio. */
export function canAddSection(type: SectionType, sections: SectionBlock[]): boolean {
  if (type === "hero") return !sections.some((s) => s.type === "hero");
  return true;
}
