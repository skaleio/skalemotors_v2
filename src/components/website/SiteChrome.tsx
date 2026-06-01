import { isLuxuryTheme } from "@/lib/website/theme";
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

/** Header sticky + footer mínimo (estilo vitrina premium). */
export function SiteChrome({
  siteName,
  logoUrl,
  whatsappPhone,
  theme,
  navItems = [],
  children,
}: SiteChromeProps) {
  const luxury = isLuxuryTheme(theme);
  const wa = waLink(whatsappPhone);
  const stockHref =
    navItems.find((n) => n.href.includes("stock"))?.href ?? "#stock";

  if (!luxury) {
    return <>{children}</>;
  }

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
            {logoUrl ? (
              <img src={logoUrl} alt={siteName ?? "Logo"} className="h-9 w-auto object-contain" />
            ) : (
              <span
                className="truncate text-sm font-bold uppercase tracking-widest"
                style={{ fontFamily: "var(--sm-font-heading)" }}
              >
                {siteName ?? "Automotora"}
              </span>
            )}
          </a>
          <nav
            className="hidden max-w-[50%] flex-wrap items-center justify-end gap-x-6 gap-y-1 text-sm md:flex"
            style={{ color: "var(--sm-muted)" }}
          >
            {navItems.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className="whitespace-nowrap transition-colors hover:text-[var(--sm-fg)]"
              >
                {item.label}
              </a>
            ))}
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
              className="rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide"
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

      <footer
        className="border-t px-6 py-8 text-center text-xs"
        style={{ borderColor: "var(--sm-border)", color: "var(--sm-muted)" }}
      >
        <p>
          © {new Date().getFullYear()} {siteName ?? "Automotora"}. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
