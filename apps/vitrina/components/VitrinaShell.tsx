"use client";

import React, { type ReactNode } from "react";

import { SiteThemeProvider } from "./SiteThemeProvider";
import { googleFontsHref, type ThemeableSite } from "@/lib/website/theme";

interface VitrinaShellProps {
  site: ThemeableSite & { favicon_url?: string | null };
  children: ReactNode;
}

export function VitrinaShell({ site, children }: VitrinaShellProps) {
  const fontsHref = googleFontsHref(site);

  return (
    <>
      <link rel="stylesheet" href={fontsHref} />
      <SiteThemeProvider site={site}>{children}</SiteThemeProvider>
    </>
  );
}
