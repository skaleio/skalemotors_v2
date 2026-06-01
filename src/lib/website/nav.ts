import {
  SECTION_LABELS,
  type SectionBlock,
  type SectionType,
  getSectionAnchor,
} from "./sections";

export interface NavItem {
  id: string;
  label: string;
  href: string;
}

const DEFAULT_SHOW_IN_NAV: Record<SectionType, boolean> = {
  hero: true,
  vehiculos: true,
  contacto: true,
  consignaciones: true,
  vende_tu_auto: true,
};

/** Enlaces del header generados desde las secciones visibles del sitio. */
export function buildNavItems(sections: SectionBlock[]): NavItem[] {
  return sections
    .filter((s) => s.visible && (s.showInNav ?? DEFAULT_SHOW_IN_NAV[s.type]))
    .map((s) => ({
      id: s.id,
      label: (s.navLabel?.trim() || SECTION_LABELS[s.type]).trim(),
      href: s.type === "hero" ? "#inicio" : `#${getSectionAnchor(s)}`,
    }));
}

/** Primer ancla de stock (vehículos) para CTAs del hero. */
export function firstStockHref(sections: SectionBlock[]): string {
  const veh = sections.find((s) => s.type === "vehiculos" && s.visible);
  return veh ? `#${getSectionAnchor(veh)}` : "#stock";
}
