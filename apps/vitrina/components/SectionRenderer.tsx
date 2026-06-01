import { LeadForm } from "./LeadForm";

import { SiteChrome } from "@/components/website/SiteChrome";

import { coerceSections } from "@/lib/website/sections";

import { buildNavItems } from "@/lib/website/nav";

import { isLuxuryTheme } from "@/lib/website/theme";

import { renderSectionNodes } from "@/components/website/SectionContent";

import { SiteThemeProvider } from "./SiteThemeProvider";

import { toPreviewVehicle } from "@vitrina/lib/mapVehicle";

import type { PublicSite, PublicVehicle } from "@vitrina/lib/vitrinaApi";



interface SectionRendererProps {

  site: PublicSite;

  vehicles: PublicVehicle[];

  host: string;

}



export function SectionRenderer({ site, vehicles, host }: SectionRendererProps) {

  const sections = coerceSections(site.sections).filter((s) => s.visible);

  const previewVehicles = vehicles.map(toPreviewVehicle);

  const luxury = isLuxuryTheme(site.theme);

  const navItems = buildNavItems(sections);

  const themeSite = {

    theme: site.theme,

    primary_color: site.primary_color,

    secondary_color: site.secondary_color,

    font: site.font,

  };



  const ctx = {

    sections,

    theme: site.theme,

    siteName: site.site_name,

    logoUrl: site.logo_url,

    whatsappPhone: site.whatsapp_phone,

    contact: {

      siteName: site.site_name,

      whatsapp: site.whatsapp_phone,

      phone: site.contact_phone,

      email: site.contact_email,

      address: site.address,

    },

    vehicles: previewVehicles,

    linkBasePath: "/vehiculo",

    heroSiteFields: site,

    contactForm: <LeadForm host={host} />,

  };



  const featuresRef = { current: false };

  const children = sections.flatMap((section) =>

    renderSectionNodes(section, ctx, {

      insertFeaturesAfterHero: luxury,

      featuresInsertedRef: featuresRef,

    }),

  );



  return (

    <SiteThemeProvider site={themeSite}>

      <SiteChrome

        siteName={site.site_name}

        logoUrl={site.logo_url}

        whatsappPhone={site.whatsapp_phone}

        theme={site.theme}

        navItems={navItems}

      >

        {children}

      </SiteChrome>

    </SiteThemeProvider>

  );

}

