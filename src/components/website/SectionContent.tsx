import type { ReactNode } from "react";
import type { TenantSite } from "@/lib/services/tenantSite";
import { mergeHeroProps } from "@/lib/website/mergeHero";
import { firstStockHref } from "@/lib/website/nav";
import {
  getSectionAnchor,
  type ContactoProps,
  type ConsignacionesProps,
  type HeroProps,
  type SectionBlock,
  type VehiculosProps,
  type VendeTuAutoProps,
} from "@/lib/website/sections";
import { isLuxuryTheme } from "@/lib/website/theme";
import { HeroBlock } from "./blocks/HeroBlock";
import { VehiclesBlock, type PreviewVehicle } from "./blocks/VehiclesBlock";
import { ContactBlock, type SiteContactInfo } from "./blocks/ContactBlock";
import { ConsignacionesBlock } from "./blocks/ConsignacionesBlock";
import { VendeTuAutoBlock } from "./blocks/VendeTuAutoBlock";
import { FeaturesStrip } from "./FeaturesStrip";
import { StatsBar } from "./StatsBar";

export interface SectionRenderContext {
  sections: SectionBlock[];
  theme?: string | null;
  siteName?: string | null;
  logoUrl?: string | null;
  whatsappPhone?: string | null;
  contact?: SiteContactInfo;
  vehicles?: PreviewVehicle[];
  vehiclesLoading?: boolean;
  preview?: boolean;
  linkBasePath?: string;
  /** Sitio (columnas hero legacy) para merge en vitrina. */
  heroSiteFields?: TenantSite | null;
  /** Slot del formulario de contacto (vitrina pública). */
  contactForm?: ReactNode;
}

export function renderSectionNodes(
  section: SectionBlock,
  ctx: SectionRenderContext,
  opts?: { insertFeaturesAfterHero?: boolean; featuresInsertedRef?: { current: boolean } },
): ReactNode[] {
  const luxury = isLuxuryTheme(ctx.theme);
  const anchor = getSectionAnchor(section);
  const nodes: ReactNode[] = [];

  switch (section.type) {
    case "hero": {
      const heroProps = ctx.heroSiteFields
        ? mergeHeroProps(section.props as HeroProps, ctx.heroSiteFields)
        : (section.props as HeroProps);
      nodes.push(
        <HeroBlock
          key={section.id}
          props={heroProps}
          siteName={ctx.siteName}
          logoUrl={ctx.logoUrl}
          theme={ctx.theme}
          whatsappPhone={ctx.whatsappPhone}
          preview={ctx.preview}
          stockHref={firstStockHref(ctx.sections)}
        />,
      );
      if (
        luxury &&
        opts?.insertFeaturesAfterHero &&
        opts.featuresInsertedRef &&
        !opts.featuresInsertedRef.current
      ) {
        nodes.push(<FeaturesStrip key="features-strip" />);
        opts.featuresInsertedRef.current = true;
      }
      break;
    }
    case "vehiculos":
      nodes.push(
        <VehiclesBlock
          key={section.id}
          props={section.props as VehiculosProps}
          vehicles={ctx.vehicles ?? []}
          loading={ctx.vehiclesLoading}
          theme={ctx.theme}
          linkBasePath={ctx.linkBasePath}
          anchorId={anchor}
        />,
      );
      if (luxury) {
        nodes.push(
          <StatsBar
            key={`stats-${section.id}`}
            vehicleCount={ctx.vehicles?.length ?? 0}
          />,
        );
      }
      break;
    case "contacto":
      nodes.push(
        <ContactBlock
          key={section.id}
          props={section.props as ContactoProps}
          anchorId={anchor}
          contact={ctx.contact ?? { siteName: ctx.siteName, whatsapp: ctx.whatsappPhone }}
          preview={ctx.preview}
          formNode={ctx.contactForm}
        />,
      );
      break;
    case "consignaciones":
      nodes.push(
        <ConsignacionesBlock
          key={section.id}
          props={section.props as ConsignacionesProps}
          anchorId={anchor}
          whatsappPhone={ctx.whatsappPhone}
        />,
      );
      break;
    case "vende_tu_auto":
      nodes.push(
        <VendeTuAutoBlock
          key={section.id}
          props={section.props as VendeTuAutoProps}
          anchorId={anchor}
          whatsappPhone={ctx.whatsappPhone}
        />,
      );
      break;
  }

  return nodes;
}
