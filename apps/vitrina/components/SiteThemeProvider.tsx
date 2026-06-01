"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";

import {
  buildTokens,
  getThemeLayout,
  googleFontsHref,
  tokensToCssVars,
  type ThemeableSite,
} from "@/lib/website/theme";
import { SITE_ANIMATIONS_CSS } from "@/lib/website/animations";

interface SiteThemeProviderProps {
  site: ThemeableSite | null | undefined;
  children: ReactNode;
  className?: string;
}

/** Copia local para la app vitrina (evita conflicto de tipos React monorepo). */
export function SiteThemeProvider({ site, children, className }: SiteThemeProviderProps) {
  const tokens = buildTokens(site);
  const cssVars = tokensToCssVars(tokens) as CSSProperties;
  const href = googleFontsHref(site);
  const layout = getThemeLayout(site?.theme);

  useEffect(() => {
    const id = `sm-fonts-${btoa(href).replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [href]);

  return (
    <div
      className={className}
      data-sm-layout={layout}
      style={{
        ...cssVars,
        background: "var(--sm-bg)",
        color: "var(--sm-fg)",
        fontFamily: "var(--sm-font-body)",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: SITE_ANIMATIONS_CSS }} />
      {children}
    </div>
  );
}
