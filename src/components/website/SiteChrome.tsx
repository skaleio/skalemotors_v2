import { getThemeLayout, isThemeId, type ThemeId } from "@/lib/website/theme";
import type { NavItem } from "@/lib/website/nav";

interface SiteChromeProps {
  siteName?: string | null;
  logoUrl?: string | null;
  whatsappPhone?: string | null;
  theme?: string | null;
  navItems?: NavItem[];
  children: React.ReactNode;
}

function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

function stockHrefFromNav(navItems: NavItem[]): string {
  return navItems.find((n) => n.href.includes("stock"))?.href ?? "#stock";
}

function NavLinks({ items }: { items: NavItem[] }) {
  return (
    <>
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          className="whitespace-nowrap transition-colors hover:text-[var(--sm-fg)]"
        >
          {item.label}
        </a>
      ))}
    </>
  );
}

function LogoBlock({ siteName, logoUrl, className = "" }: { siteName?: string | null; logoUrl?: string | null; className?: string }) {
  if (logoUrl) {
    return <img src={logoUrl} alt={siteName ?? "Logo"} className={`h-9 w-auto object-contain ${className}`} />;
  }
  return (
    <span
      className={`truncate text-sm font-bold ${className}`}
      style={{ fontFamily: "var(--sm-font-heading)", color: "var(--sm-fg)" }}
    >
      {siteName ?? "Automotora"}
    </span>
  );
}

/** Header + footer según plantilla (modern / classic / luxury). */
export function SiteChrome({
  siteName,
  logoUrl,
  whatsappPhone,
  theme,
  navItems = [],
  children,
}: SiteChromeProps) {
  const layout = getThemeLayout(theme);
  const wa = waLink(whatsappPhone);
  const stockHref = stockHrefFromNav(navItems);
  const themeId: ThemeId = isThemeId(theme) ? theme : "moderna";

  const footer = (
    <footer
      className="border-t px-6 py-8 text-center text-xs"
      style={{ borderColor: "var(--sm-border)", color: "var(--sm-muted)" }}
    >
      <p>
        © {new Date().getFullYear()} {siteName ?? "Automotora"}. Todos los derechos reservados.
      </p>
    </footer>
  );

  if (layout === "classic") {
    return (
      <div className="min-h-full" style={{ background: "var(--sm-bg)", color: "var(--sm-fg)" }}>
        <header
          className="border-b px-4 py-6 md:px-8"
          style={{
            borderColor: "var(--sm-border)",
            backgroundColor: "var(--sm-surface)",
          }}
        >
          <div className="mx-auto max-w-5xl text-center">
            <a href="#inicio" className="inline-flex flex-col items-center gap-3">
              <LogoBlock siteName={siteName} logoUrl={logoUrl} className="h-11" />
            </a>
            {navItems.length > 0 ? (
              <nav
                className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm"
                style={{ color: "var(--sm-muted)", fontFamily: "var(--sm-font-body)" }}
              >
                <NavLinks items={navItems} />
              </nav>
            ) : null}
            <div className="mx-auto mt-5 h-px w-24" style={{ backgroundColor: "var(--sm-primary)" }} />
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-sm underline-offset-4 hover:underline"
                style={{ color: "var(--sm-primary)" }}
              >
                Contactar por WhatsApp
              </a>
            ) : null}
          </div>
        </header>
        {children}
        {footer}
      </div>
    );
  }

  if (layout === "modern") {
    return (
      <div className="min-h-full" style={{ background: "var(--sm-bg)", color: "var(--sm-fg)" }}>
        <header
          className="sticky top-0 z-50 border-b shadow-sm"
          style={{
            borderColor: "var(--sm-border)",
            backgroundColor: "color-mix(in srgb, var(--sm-bg) 96%, white)",
          }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 md:px-6">
            <a href="#inicio" className="flex min-w-0 items-center gap-2">
              <LogoBlock siteName={siteName} logoUrl={logoUrl} />
            </a>
            <nav
              className="hidden items-center gap-6 text-sm font-medium md:flex"
              style={{ color: "var(--sm-muted)" }}
            >
              <NavLinks items={navItems} />
            </nav>
            <div className="flex shrink-0 items-center gap-2">
              {wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden text-sm font-medium md:inline-block"
                  style={{ color: "var(--sm-primary)" }}
                >
                  WhatsApp
                </a>
              ) : null}
              <a
                href={stockHref}
                className="rounded-full px-5 py-2 text-sm font-semibold shadow-md"
                style={{
                  backgroundColor: "var(--sm-primary)",
                  color: "var(--sm-primary-fg)",
                }}
              >
                Ver autos
              </a>
            </div>
          </div>
        </header>
        {children}
        {footer}
      </div>
    );
  }

  // luxury (Premium + Miami)
  const headerUppercase = themeId === "miami";

  return (
    <div className="min-h-full" style={{ background: "var(--sm-bg)", color: "var(--sm-fg)" }}>
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          borderColor: "color-mix(in srgb, var(--sm-border) 80%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--sm-bg) 88%, transparent)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <a href="#inicio" className="flex min-w-0 items-center gap-3">
            <LogoBlock
              siteName={siteName}
              logoUrl={logoUrl}
              className={headerUppercase ? "uppercase tracking-widest" : ""}
            />
          </a>
          <nav
            className="hidden max-w-[50%] flex-wrap items-center justify-end gap-x-6 gap-y-1 text-sm md:flex"
            style={{ color: "var(--sm-muted)" }}
          >
            <NavLinks items={navItems} />
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden rounded-md border px-3 py-1.5 text-xs font-medium sm:inline-block"
                style={{ borderColor: "var(--sm-border)", color: "var(--sm-fg)" }}
              >
                WhatsApp
              </a>
            ) : null}
            <a
              href={stockHref}
              className={`rounded-md px-4 py-2 text-xs font-semibold tracking-wide ${headerUppercase ? "uppercase" : ""}`}
              style={{
                backgroundColor: "var(--sm-primary)",
                color: "var(--sm-primary-fg)",
                borderRadius: "var(--sm-radius)",
              }}
            >
              Ver stock
            </a>
          </div>
        </div>
      </header>
      {children}
      {footer}
    </div>
  );
}
