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

/**
 * Inyecta los design tokens del sitio como variables CSS (--sm-*) y define las
 * fuentes base. Carga el <link> de Google Fonts del par activo (idempotente por id).
 * Mismo componente para el preview del editor y la web pública.
 */
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
