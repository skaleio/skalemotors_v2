import type { LucideIcon } from "lucide-react";
import {
  Car,
  Handshake,
  LayoutTemplate,
  Mail,
  Tag,
} from "lucide-react";

import type { SectionType } from "./sections";

export interface SectionCatalogEntry {
  type: SectionType;
  title: string;
  description: string;
  /** Cuántas veces se puede agregar; omitido = sin límite práctico. */
  maxCount?: number;
  icon: LucideIcon;
  /** Orden sugerido al armar un sitio desde cero (menor = más arriba). */
  suggestedOrder: number;
}

export const SECTION_CATALOG: SectionCatalogEntry[] = [
  {
    type: "hero",
    title: "Portada",
    description: "Imagen principal, título y botón hacia el stock.",
    maxCount: 1,
    icon: LayoutTemplate,
    suggestedOrder: 0,
  },
  {
    type: "vehiculos",
    title: "Vehículos",
    description: "Grilla de autos publicados desde tu inventario.",
    icon: Car,
    suggestedOrder: 1,
  },
  {
    type: "consignaciones",
    title: "Consignaciones",
    description: "Explica el servicio de consignación y un CTA.",
    icon: Handshake,
    suggestedOrder: 2,
  },
  {
    type: "vende_tu_auto",
    title: "Vende tu auto",
    description: "Beneficios y llamado a acción para quien quiere vender.",
    icon: Tag,
    suggestedOrder: 3,
  },
  {
    type: "contacto",
    title: "Contacto",
    description: "Datos de contacto y formulario de consultas.",
    icon: Mail,
    suggestedOrder: 4,
  },
];

export function getCatalogEntry(type: SectionType): SectionCatalogEntry {
  const entry = SECTION_CATALOG.find((e) => e.type === type);
  if (!entry) throw new Error(`Unknown section type: ${type}`);
  return entry;
}
