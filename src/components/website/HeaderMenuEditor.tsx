import { useMemo } from "react";
import { Menu, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildNavItems } from "@/lib/website/nav";
import {
  SECTION_LABELS,
  isSectionInNav,
  sectionListLabel,
  type SectionBlock,
} from "@/lib/website/sections";

interface HeaderMenuEditorProps {
  sections: SectionBlock[];
  onUpdateSection: (
    id: string,
    patch: Partial<Pick<SectionBlock, "showInNav" | "navLabel">>,
  ) => void;
}

export function HeaderMenuEditor({ sections, onUpdateSection }: HeaderMenuEditorProps) {
  const navItems = useMemo(() => buildNavItems(sections), [sections]);

  const visibleSections = sections.filter((s) => s.visible);
  const hiddenSections = sections.filter((s) => !s.visible);
  const inMenu = visibleSections.filter((s) => isSectionInNav(s));
  const notInMenu = visibleSections.filter((s) => !isSectionInNav(s));

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-2">
        <Menu className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold">Menú del header</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Elegí qué secciones aparecen en la barra superior. El orden del menú sigue el de la
            lista de secciones (usá subir/bajar para reordenar).
          </p>
        </div>
      </div>

      {visibleSections.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No hay secciones visibles. Activá al menos una sección en la página para armar el menú.
        </p>
      ) : (
        <>
          {inMenu.length > 0 ? (
            <ul className="space-y-2">
              {sections
                .filter((s) => s.visible && isSectionInNav(s))
                .map((s) => (
                  <li
                    key={s.id}
                    className="space-y-2 rounded-md border border-violet-200 bg-violet-50/40 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-violet-900">
                        {sectionListLabel(s, sections)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => onUpdateSection(s.id, { showInNav: false })}
                      >
                        <X className="h-3 w-3" />
                        Quitar
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground">
                        Texto en el menú
                      </Label>
                      <Input
                        value={s.navLabel ?? ""}
                        onChange={(e) => onUpdateSection(s.id, { navLabel: e.target.value })}
                        placeholder={SECTION_LABELS[s.type]}
                        className="h-8 text-xs"
                      />
                    </div>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              El menú está vacío. Agregá enlaces desde las secciones de abajo.
            </p>
          )}

          {notInMenu.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground">
                Agregar al menú
              </p>
              <ul className="space-y-1.5">
                {notInMenu.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2.5 py-2"
                  >
                    <span className="truncate text-xs font-medium">
                      {sectionListLabel(s, sections)}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 gap-1 text-xs"
                      onClick={() => onUpdateSection(s.id, { showInNav: true })}
                    >
                      <Plus className="h-3 w-3" />
                      Agregar
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      {hiddenSections.length > 0 ? (
        <div className="space-y-1.5 border-t pt-3">
          <p className="text-[11px] font-medium text-muted-foreground">
            Secciones ocultas (no van al menú)
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {hiddenSections.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{sectionListLabel(s, sections)}</span>
                <span className="shrink-0 text-[10px]">Mostrá la sección primero</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {navItems.length > 0 ? (
        <div className="rounded-md border bg-muted/20 px-3 py-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Vista previa del menú
          </p>
          <div className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <span
                key={item.id}
                className="rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium"
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
