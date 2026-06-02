import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  LayoutList,
  Menu,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HeaderMenuEditor } from "./HeaderMenuEditor";
import { SECTION_CATALOG } from "@/lib/website/sectionCatalog";
import {
  createSection,
  defaultSections,
  duplicateSection,
  getAddSectionAvailability,
  insertSectionAt,
  isSectionInNav,
  sectionListLabel,
  validateSiteSections,
  type SectionBlock,
  type SectionType,
} from "@/lib/website/sections";

type InsertMode = "end" | "start" | "after";

interface SiteStructurePanelProps {
  sections: SectionBlock[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onSectionsChangeWithHistory: (updater: (prev: SectionBlock[]) => SectionBlock[]) => void;
  onUpdateSectionNav: (
    id: string,
    patch: Partial<Pick<SectionBlock, "showInNav" | "navLabel">>,
  ) => void;
}

export function SiteStructurePanel({
  sections,
  selectedId,
  onSelect,
  onSectionsChangeWithHistory,
  onUpdateSectionNav,
}: SiteStructurePanelProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [insertMode, setInsertMode] = useState<InsertMode>("end");
  const [deleteTarget, setDeleteTarget] = useState<SectionBlock | null>(null);

  const issues = useMemo(() => validateSiteSections(sections), [sections]);

  const openAddDialog = (open: boolean) => {
    setAddOpen(open);
    if (open) setInsertMode(selectedId ? "after" : "end");
  };

  const confirmAdd = (type: SectionType) => {
    const availability = getAddSectionAvailability(type, sections);
    if (!availability.allowed) return;

    const block = createSection(type);
    onSectionsChangeWithHistory((prev) => {
      if (insertMode === "start") {
        return insertSectionAt(prev, block, { mode: "start" });
      }
      if (insertMode === "end") {
        return insertSectionAt(prev, block, { mode: "end" });
      }
      const afterId =
        selectedId && prev.some((s) => s.id === selectedId) ? selectedId : prev.at(-1)?.id;
      if (afterId) {
        return insertSectionAt(prev, block, { mode: "after", id: afterId });
      }
      return insertSectionAt(prev, block, { mode: "end" });
    });

    onSelect(block.id);
    setAddOpen(false);
  };

  const handleRestoreDefaults = () => {
    onSectionsChangeWithHistory(() => defaultSections());
    onSelect(null);
  };

  const handleDuplicate = (section: SectionBlock) => {
    const availability = getAddSectionAvailability(section.type, sections);
    if (!availability.allowed) return;
    const copy = duplicateSection(section);
    if (!copy) return;
    onSectionsChangeWithHistory((prev) =>
      insertSectionAt(prev, copy, { mode: "after", id: section.id }),
    );
    onSelect(copy.id);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onSectionsChangeWithHistory((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    if (selectedId === deleteTarget.id) onSelect(null);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-3">
      {issues.length > 0 ? (
        <div className="space-y-2">
          {issues.map((issue) => (
            <Alert
              key={issue.code}
              variant={issue.severity === "error" ? "destructive" : "default"}
              className="py-2"
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-xs font-semibold">
                {issue.severity === "error" ? "Revisar antes de publicar" : "Sugerencia"}
              </AlertTitle>
              <AlertDescription className="text-xs">{issue.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          La estructura del sitio se ve bien. Podés seguir personalizando y guardar cuando quieras.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={addOpen} onOpenChange={openAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Agregar sección
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Agregar sección</DialogTitle>
              <DialogDescription>
                Elegí el bloque y dónde insertarlo. Podés reordenar después desde la lista.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label className="text-xs">Insertar</Label>
              <Select
                value={insertMode}
                onValueChange={(v) => setInsertMode(v as InsertMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="end">Al final de la página</SelectItem>
                  <SelectItem value="start">Al inicio (debajo del menú)</SelectItem>
                  {selectedId ? (
                    <SelectItem value="after">
                      Después de «
                      {sectionListLabel(
                        sections.find((s) => s.id === selectedId)!,
                        sections,
                      )}
                      »
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
              {selectedId ? null : (
                <p className="text-[11px] text-muted-foreground">
                  Tip: seleccioná una sección en la lista para insertar justo debajo de ella.
                </p>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-1">
              {SECTION_CATALOG.map((entry) => {
                const availability = getAddSectionAvailability(entry.type, sections);
                const Icon = entry.icon;
                return (
                  <button
                    key={entry.type}
                    type="button"
                    disabled={!availability.allowed}
                    onClick={() => {
                      if (!availability.allowed) return;
                      confirmAdd(entry.type);
                    }}
                    className={`flex gap-3 rounded-lg border p-3 text-left transition-colors ${
                      availability.allowed
                        ? "hover:border-violet-400 hover:bg-violet-50/50"
                        : "cursor-not-allowed opacity-50"
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{entry.title}</span>
                        {availability.maxCount != null ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {availability.currentCount}/{availability.maxCount}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{entry.description}</p>
                      {!availability.allowed && availability.reason ? (
                        <p className="mt-1 text-[11px] font-medium text-amber-700">
                          {availability.reason}
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <DialogFooter className="sm:justify-start">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAddOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleRestoreDefaults}
          title="Portada + vehículos + contacto"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Estructura básica
        </Button>
      </div>

      <div className="space-y-2 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <LayoutList className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Secciones de la página</p>
          <Badge variant="outline" className="ml-auto text-[10px]">
            {sections.length}
          </Badge>
        </div>

        {sections.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sin secciones. Usá «Agregar sección» o «Estructura básica».
          </p>
        ) : (
          <ul className="space-y-1.5">
            {sections.map((s, i) => (
              <li
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`flex cursor-pointer items-center justify-between rounded-md border px-2.5 py-2 text-sm transition-colors ${
                  selectedId === s.id
                    ? "border-violet-500 bg-violet-50"
                    : "hover:bg-muted/50"
                } ${s.visible ? "" : "opacity-50"}`}
              >
                <div className="min-w-0 pr-2">
                  <span className="block truncate font-medium">
                    {sectionListLabel(s, sections)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {s.visible ? "Visible" : "Oculta"}
                    {s.visible && isSectionInNav(s) ? " · en menú" : ""}
                  </span>
                </div>
                <span className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    className="rounded p-1 hover:bg-muted disabled:opacity-30"
                    disabled={i === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSectionsChangeWithHistory((prev) => {
                        const idx = prev.findIndex((x) => x.id === s.id);
                        const target = idx - 1;
                        if (idx < 0 || target < 0) return prev;
                        const next = [...prev];
                        [next[idx], next[target]] = [next[target], next[idx]];
                        return next;
                      });
                    }}
                    title="Subir"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 hover:bg-muted disabled:opacity-30"
                    disabled={i === sections.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSectionsChangeWithHistory((prev) => {
                        const idx = prev.findIndex((x) => x.id === s.id);
                        const target = idx + 1;
                        if (idx < 0 || target >= prev.length) return prev;
                        const next = [...prev];
                        [next[idx], next[target]] = [next[target], next[idx]];
                        return next;
                      });
                    }}
                    title="Bajar"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 hover:bg-muted disabled:opacity-30"
                    disabled={!getAddSectionAvailability(s.type, sections).allowed}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicate(s);
                    }}
                    title="Duplicar"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className={`rounded p-1 hover:bg-muted disabled:opacity-30 ${
                      s.visible && isSectionInNav(s) ? "text-violet-600" : ""
                    }`}
                    disabled={!s.visible}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateSectionNav(s.id, { showInNav: !isSectionInNav(s) });
                    }}
                    title={
                      !s.visible
                        ? "La sección está oculta"
                        : isSectionInNav(s)
                          ? "Quitar del menú"
                          : "Agregar al menú"
                    }
                  >
                    <Menu className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSectionsChangeWithHistory((prev) =>
                        prev.map((x) => (x.id === s.id ? { ...x, visible: !x.visible } : x)),
                      );
                    }}
                    title={s.visible ? "Ocultar sección" : "Mostrar sección"}
                  >
                    {s.visible ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(s);
                    }}
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <HeaderMenuEditor sections={sections} onUpdateSection={onUpdateSectionNav} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta sección?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Se quitará «${sectionListLabel(deleteTarget, sections)}» de la página. Podés deshacer con Ctrl+Z antes de guardar.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
