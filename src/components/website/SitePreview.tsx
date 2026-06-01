import type { ReactNode } from "react";
import type { SectionBlock } from "@/lib/website/sections";
import { buildNavItems } from "@/lib/website/nav";
import { getThemeLayout, type ThemeableSite } from "@/lib/website/theme";
import { renderSectionNodes } from "./SectionContent";
import type { PreviewVehicle } from "./blocks/VehiclesBlock";
import { SiteChrome } from "./SiteChrome";
import { SiteThemeProvider } from "./SiteThemeProvider";

interface SitePreviewProps {
  sections: SectionBlock[];
  themeSite: ThemeableSite;
  siteName?: string | null;
  logoUrl?: string | null;
  whatsappPhone?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  vehicles: PreviewVehicle[];
  vehiclesLoading?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  preview?: boolean;
}

export function SitePreview({
  sections,
  themeSite,
  siteName,
  logoUrl,
  whatsappPhone,
  contactEmail,
  contactPhone,
  address,
  vehicles,
  vehiclesLoading,
  selectedId,
  onSelect,
  preview = false,
}: SitePreviewProps) {
  const visible = sections.filter((s) => s.visible);
  const luxury = getThemeLayout(themeSite.theme) === "luxury";
  const navItems = buildNavItems(sections);

  const wrapSection = (id: string, node: ReactNode) => (
    <div
      key={id}
      onClick={() => onSelect?.(id)}
      className={`relative cursor-pointer transition-all ${
        selectedId === id ? "ring-2 ring-inset ring-violet-500" : ""
      }`}
    >
      {node}
    </div>
  );

  const ctx = {
    sections,
    theme: themeSite.theme,
    siteName,
    logoUrl,
    whatsappPhone,
    contact: {
      siteName,
      whatsapp: whatsappPhone,
      phone: contactPhone,
      email: contactEmail,
      address,
    },
    vehicles,
    vehiclesLoading,
    preview,
  };

  let body: ReactNode;
  if (visible.length === 0) {
    body = (
      <div
        className="flex h-full min-h-[300px] items-center justify-center text-sm"
        style={{ color: "var(--sm-muted)" }}
      >
        Agregá una sección desde el panel izquierdo para ver tu sitio.
      </div>
    );
  } else {
    const featuresRef = { current: false };
    const nodes: ReactNode[] = [];
    for (const section of visible) {
      const rendered = renderSectionNodes(section, ctx, {
        insertFeaturesAfterHero: luxury,
        featuresInsertedRef: featuresRef,
      });
      nodes.push(wrapSection(section.id, <>{rendered}</>));
    }
    body = nodes;
  }

  return (
    <SiteThemeProvider site={themeSite}>
      <SiteChrome
        siteName={siteName}
        logoUrl={logoUrl}
        whatsappPhone={whatsappPhone}
        theme={themeSite.theme}
        navItems={navItems}
      >
        {body}
      </SiteChrome>
    </SiteThemeProvider>
  );
}
