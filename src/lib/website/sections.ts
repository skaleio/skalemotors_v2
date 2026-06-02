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

/** Si una sección nueva aparece en el menú del header por defecto. */
export const DEFAULT_SHOW_IN_NAV: Record<SectionType, boolean> = {
  hero: true,
  vehiculos: true,
  contacto: true,
  consignaciones: false,
  vende_tu_auto: false,
};

export function isSectionInNav(section: SectionBlock): boolean {
  return section.showInNav ?? DEFAULT_SHOW_IN_NAV[section.type];
}

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

/** Límites por tipo (debe coincidir con sectionCatalog.maxCount). */
const MAX_SECTION_COUNT: Partial<Record<SectionType, number>> = {
  hero: 1,
};

/**
 * Ancla HTML para scroll y menú. Si hay varias secciones del mismo tipo,
 * cada una recibe un id único para evitar enlaces rotos.
 */
export function getSectionAnchor(
  section: SectionBlock,
  allSections?: SectionBlock[],
): string {
  if (section.type === "hero") return "inicio";
  const base = ANCHOR_BY_TYPE[section.type] ?? section.id;
  if (!allSections?.length) return base;
  const sameType = allSections.filter((s) => s.type === section.type);
  if (sameType.length <= 1) return base;
  const suffix = section.id.replace(/^s_/, "");
  return `${base}-${suffix}`;
}

/** Etiqueta en listas del editor cuando hay secciones repetidas. */
export function sectionListLabel(
  section: SectionBlock,
  allSections: SectionBlock[],
): string {
  const custom = section.navLabel?.trim();
  const base = custom || SECTION_LABELS[section.type];
  const sameType = allSections.filter((s) => s.type === section.type);
  if (sameType.length <= 1) return base;
  const index = sameType.findIndex((s) => s.id === section.id) + 1;
  return `${SECTION_LABELS[section.type]} ${index}${custom ? ` · ${custom}` : ""}`;
}

export type SectionIssueSeverity = "error" | "warning";

export interface SectionIssue {
  code: string;
  severity: SectionIssueSeverity;
  message: string;
}

export interface AddSectionAvailability {
  allowed: boolean;
  reason?: string;
  currentCount: number;
  maxCount?: number;
}

export function getAddSectionAvailability(
  type: SectionType,
  sections: SectionBlock[],
): AddSectionAvailability {
  const currentCount = sections.filter((s) => s.type === type).length;
  const maxCount = MAX_SECTION_COUNT[type];

  if (maxCount != null && currentCount >= maxCount) {
    return {
      allowed: false,
      currentCount,
      maxCount,
      reason:
        type === "hero"
          ? "Solo puede haber una portada. Editá la existente o eliminála primero."
          : `Máximo ${maxCount} sección(es) de este tipo.`,
    };
  }

  return { allowed: true, currentCount, maxCount };
}

export function validateSiteSections(sections: SectionBlock[]): SectionIssue[] {
  const issues: SectionIssue[] = [];

  if (sections.length === 0) {
    issues.push({
      code: "empty",
      severity: "error",
      message: "El sitio no tiene secciones. Agregá al menos una portada o usá «Restaurar estructura básica».",
    });
    return issues;
  }

  const visible = sections.filter((s) => s.visible);
  if (visible.length === 0) {
    issues.push({
      code: "all_hidden",
      severity: "warning",
      message: "Todas las secciones están ocultas. Los visitantes verán una página vacía.",
    });
  }

  if (!sections.some((s) => s.type === "hero")) {
    issues.push({
      code: "no_hero",
      severity: "warning",
      message: "No hay portada. Recomendamos agregar una para presentar tu automotora.",
    });
  } else if (!sections.some((s) => s.type === "hero" && s.visible)) {
    issues.push({
      code: "hero_hidden",
      severity: "warning",
      message: "La portada está oculta. Activá la visibilidad o agregá otra portada.",
    });
  }

  if (!sections.some((s) => s.type === "vehiculos")) {
    issues.push({
      code: "no_stock",
      severity: "warning",
      message: "No hay sección de vehículos. La mayoría de sitios muestran el stock en la página principal.",
    });
  }

  return issues;
}

export function hasBlockingSectionIssues(issues: SectionIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}

/** Listo para persistir: nunca guarda array vacío. */
export function prepareSectionsForSave(sections: SectionBlock[]): SectionBlock[] {
  if (sections.length === 0) return defaultSections();
  return sections.map((s) => ({
    ...s,
    props: normalizeProps(s.type, s.props),
  }));
}

export function duplicateSection(section: SectionBlock): SectionBlock | null {
  const copy = createSection(section.type);
  return {
    ...copy,
    visible: section.visible,
    navLabel: section.navLabel,
    showInNav: section.showInNav,
    props: normalizeProps(section.type, section.props),
  };
}

export function insertSectionAt(
  sections: SectionBlock[],
  block: SectionBlock,
  position: { mode: "end" } | { mode: "start" } | { mode: "after"; id: string },
): SectionBlock[] {
  if (position.mode === "start") return [block, ...sections];
  if (position.mode === "end") return [...sections, block];
  const idx = sections.findIndex((s) => s.id === position.id);
  if (idx < 0) return [...sections, block];
  const next = [...sections];
  next.splice(idx + 1, 0, block);
  return next;
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
    showInNav: DEFAULT_SHOW_IN_NAV[type],
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

/** Solo una portada por sitio (y otros límites en MAX_SECTION_COUNT). */
export function canAddSection(type: SectionType, sections: SectionBlock[]): boolean {
  return getAddSectionAvailability(type, sections).allowed;
}
