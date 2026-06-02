import {
  DEFAULT_SHOW_IN_NAV,
  SECTION_LABELS,
  isSectionInNav,
  type SectionBlock,
  getSectionAnchor,
} from "./sections";

export { isSectionInNav };

export interface NavItem {
  id: string;
  label: string;
  href: string;
}

/** Enlaces del header generados desde las secciones visibles del sitio. */
export function buildNavItems(sections: SectionBlock[]): NavItem[] {
  return sections
    .filter((s) => s.visible && isSectionInNav(s))
    .map((s) => ({
      id: s.id,
      label: (s.navLabel?.trim() || SECTION_LABELS[s.type]).trim(),
      href: `#${getSectionAnchor(s, sections)}`,
    }));
}

/** Primer ancla de stock (vehículos) para CTAs del hero. */
export function firstStockHref(sections: SectionBlock[]): string {
  const veh = sections.find((s) => s.type === "vehiculos" && s.visible);
  return veh ? `#${getSectionAnchor(veh, sections)}` : "#stock";
}
