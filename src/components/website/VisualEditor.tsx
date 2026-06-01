import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateTenantSite } from "@/hooks/useTenantSite";
import { useSiteVehicles } from "@/hooks/useSiteVehicles";
import { useUploadSiteImage } from "@/hooks/useUploadSiteImage";
import type { TenantSite } from "@/lib/services/tenantSite";
import {
  SECTION_LABELS,
  canAddSection,
  coerceSections,
  createSection,
  type ConsignacionesProps,
  type ContactoProps,
  type HeroProps,
  type SectionBlock,
  type SectionProps,
  type SectionType,
  type VehiculosProps,
  type VendeTuAutoProps,
} from "@/lib/website/sections";
import { buildNavItems } from "@/lib/website/nav";
import {
  FONT_PAIRS,
  THEME_OPTIONS,
  THEME_PRESETS,
  isFontId,
  isThemeId,
  type FontId,
  type ThemeId,
  type ThemeableSite,
} from "@/lib/website/theme";
import { SitePreview } from "./SitePreview";

const FONT_OPTIONS = Object.entries(FONT_PAIRS).map(([id, pair]) => ({
  id: id as FontId,
  label: pair.label,
}));

interface VisualEditorProps {
  site: TenantSite;
  className?: string;
}

export function VisualEditor({ site, className }: VisualEditorProps) {
  const updateSite = useUpdateTenantSite();
  const { data: vehicles = [], isLoading: vehiclesLoading } = useSiteVehicles();

  const [sections, setSections] = useState<SectionBlock[]>(() =>
    coerceSections(site.sections),
  );
  const [siteName, setSiteName] = useState(site.site_name ?? "");
  const [primaryColor, setPrimaryColor] = useState(site.primary_color ?? "#7c3aed");
  const [secondaryColor, setSecondaryColor] = useState(site.secondary_color ?? "");
  const [theme, setTheme] = useState<ThemeId>(
    isThemeId(site.theme) ? site.theme : "moderna",
  );
  const [font, setFont] = useState<FontId | "">(isFontId(site.font) ? site.font : "");
  const [logoUrl, setLogoUrl] = useState(site.logo_url ?? "");
  const [faviconUrl, setFaviconUrl] = useState(site.favicon_url ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSections(coerceSections(site.sections));
    setSiteName(site.site_name ?? "");
    setPrimaryColor(site.primary_color ?? "#7c3aed");
    setSecondaryColor(site.secondary_color ?? "");
    setTheme(isThemeId(site.theme) ? site.theme : "moderna");
    setFont(isFontId(site.font) ? site.font : "");
    setLogoUrl(site.logo_url ?? "");
    setFaviconUrl(site.favicon_url ?? "");
    setDirty(false);
  }, [site]);

  const themeSite: ThemeableSite = {
    theme,
    primary_color: primaryColor,
    secondary_color: secondaryColor || null,
    font: font || null,
  };

  const selected = useMemo(
    () => sections.find((s) => s.id === selectedId) ?? null,
    [sections, selectedId],
  );

  const markDirty = () => setDirty(true);

  const mutateSections = (updater: (prev: SectionBlock[]) => SectionBlock[]) => {
    setSections((prev) => updater(prev));
    markDirty();
  };

  const addSection = (type: SectionType) => {
    if (!canAddSection(type, sections)) {
      toast.message("Ya existe una portada en el sitio");
      return;
    }
    const block = createSection(type);
    mutateSections((prev) => [...prev, block]);
    setSelectedId(block.id);
  };

  const updateSectionMeta = (
    id: string,
    patch: Partial<Pick<SectionBlock, "showInNav" | "navLabel">>,
  ) => {
    mutateSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  };

  const removeSection = (id: string) => {
    mutateSections((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const toggleVisible = (id: string) => {
    mutateSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)),
    );
  };

  const move = (id: string, dir: -1 | 1) => {
    mutateSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const updateProps = (id: string, patch: Partial<SectionProps>) => {
    mutateSections((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, props: { ...s.props, ...patch } } : s,
      ),
    );
  };

  const handleSave = () => {
    updateSite.mutate(
      {
        site_name: siteName,
        primary_color: primaryColor,
        secondary_color: secondaryColor || null,
        theme,
        font: font || null,
        logo_url: logoUrl || null,
        favicon_url: faviconUrl || null,
        sections: sections as unknown as TenantSite["sections"],
      },
      {
        onSuccess: () => {
          toast.success("Cambios guardados");
          setDirty(false);
        },
        onError: (e) =>
          toast.error("No se pudo guardar", {
            description: e instanceof Error ? e.message : undefined,
          }),
      },
    );
  };

  const handleTogglePublish = (value: boolean) => {
    updateSite.mutate(
      { is_published: value },
      {
        onSuccess: () =>
          toast.success(value ? "Sitio publicado" : "Sitio despublicado"),
        onError: (e) =>
          toast.error("No se pudo cambiar el estado", {
            description: e instanceof Error ? e.message : undefined,
          }),
      },
    );
  };

  return (
    <div className={`flex min-h-0 flex-col gap-3 ${className ?? ""}`}>
      {/* Barra superior */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-3">
          <Badge variant={site.is_published ? "default" : "outline"}>
            {site.is_published ? "Publicado" : "Borrador"}
          </Badge>
          <div className="flex items-center gap-2">
            <Label htmlFor="publish-switch" className="text-sm">
              Publicar
            </Label>
            <Switch
              id="publish-switch"
              checked={site.is_published}
              onCheckedChange={handleTogglePublish}
              disabled={updateSite.isPending}
            />
          </div>
        </div>
        <Button onClick={handleSave} disabled={updateSite.isPending || !dirty}>
          {updateSite.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {dirty ? "Guardar cambios" : "Guardado"}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[340px_1fr] lg:items-stretch lg:overflow-hidden">
        {/* Panel izquierdo: secciones + ajustes */}
        <div className="max-h-[min(70vh,640px)] min-h-0 space-y-4 overflow-y-auto overscroll-contain pr-0.5 lg:max-h-none lg:h-full">
          {/* Diseño: tema + marca */}
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">Diseño</p>

            <div className="space-y-1.5">
              <Label className="text-xs">Tema</Label>
              <div className="grid grid-cols-3 gap-2">
                {THEME_OPTIONS.map((t) => {
                  const preset = THEME_PRESETS[t.id];
                  const active = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTheme(t.id);
                        markDirty();
                      }}
                      title={t.description}
                      className={`rounded-md border p-2 text-left transition-all ${
                        active
                          ? "border-violet-500 ring-1 ring-violet-500"
                          : "hover:border-muted-foreground/40"
                      }`}
                    >
                      <span className="mb-1.5 flex gap-1">
                        <span
                          className="h-4 w-4 rounded-full border"
                          style={{ backgroundColor: preset.colorBg }}
                        />
                        <span
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: preset.colorPrimary }}
                        />
                      </span>
                      <span className="block text-[11px] font-medium leading-tight">
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipografía</Label>
              <Select
                value={font || `__default__${theme}`}
                onValueChange={(v) => {
                  setFont(v.startsWith("__default__") ? "" : (v as FontId));
                  markDirty();
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={`__default__${theme}`}>
                    Por defecto del tema
                  </SelectItem>
                  {FONT_OPTIONS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Color primario</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => {
                      setPrimaryColor(e.target.value);
                      markDirty();
                    }}
                    className="h-9 w-12 p-1"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => {
                      setPrimaryColor(e.target.value);
                      markDirty();
                    }}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Secundario</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={secondaryColor || THEME_PRESETS[theme].colorSecondary}
                    onChange={(e) => {
                      setSecondaryColor(e.target.value);
                      markDirty();
                    }}
                    className="h-9 w-12 p-1"
                  />
                  <Input
                    value={secondaryColor}
                    onChange={(e) => {
                      setSecondaryColor(e.target.value);
                      markDirty();
                    }}
                    placeholder="auto"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Logo</Label>
                <ImageField value={logoUrl} onChange={(url) => { setLogoUrl(url); markDirty(); }} compact />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Favicon</Label>
                <ImageField value={faviconUrl} onChange={(url) => { setFaviconUrl(url); markDirty(); }} compact />
              </div>
            </div>
          </div>

          {/* Ajustes generales */}
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">Ajustes generales</p>
            <div className="space-y-2">
              <Label htmlFor="site_name" className="text-xs">
                Nombre del sitio
              </Label>
              <Input
                id="site_name"
                value={siteName}
                onChange={(e) => {
                  setSiteName(e.target.value);
                  markDirty();
                }}
                placeholder="Ej: Miami Motors"
              />
            </div>
          </div>

          {/* Menú del header (vista previa) */}
          <div className="space-y-2 rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">Menú del header</p>
            <p className="text-xs text-muted-foreground">
              Se genera desde las secciones marcadas con &quot;Mostrar en menú&quot;. El orden sigue
              el de la lista de secciones.
            </p>
            <ul className="space-y-1 text-xs">
              {buildNavItems(sections).map((item) => (
                <li
                  key={item.id}
                  className="flex justify-between rounded-md border bg-muted/30 px-2 py-1.5"
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">{item.href}</span>
                </li>
              ))}
              {buildNavItems(sections).length === 0 ? (
                <li className="text-muted-foreground">Sin enlaces visibles</li>
              ) : null}
            </ul>
          </div>

          {/* Agregar secciones */}
          <div className="space-y-2 rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">Agregar sección</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!canAddSection("hero", sections)}
                onClick={() => addSection("hero")}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Portada
              </Button>
              <Button variant="outline" size="sm" onClick={() => addSection("vehiculos")}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Vehículos
              </Button>
              <Button variant="outline" size="sm" onClick={() => addSection("contacto")}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Contacto
              </Button>
              <Button variant="outline" size="sm" onClick={() => addSection("consignaciones")}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Consignaciones
              </Button>
              <Button variant="outline" size="sm" onClick={() => addSection("vende_tu_auto")}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Vende tu auto
              </Button>
            </div>
          </div>

          {/* Lista de secciones */}
          <div className="space-y-2 rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">Secciones</p>
            {sections.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Agregá una sección para empezar.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {sections.map((s, i) => (
                  <li
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={`flex items-center justify-between rounded-md border px-2.5 py-2 text-sm transition-colors ${
                      selectedId === s.id
                        ? "border-violet-500 bg-violet-50"
                        : "hover:bg-muted/50"
                    } ${s.visible ? "" : "opacity-50"}`}
                  >
                    <span className="font-medium">
                      {SECTION_LABELS[s.type]}
                      {s.showInNav !== false ? (
                        <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                          · menú
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <button
                        type="button"
                        className="rounded p-1 hover:bg-muted disabled:opacity-30"
                        disabled={i === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          move(s.id, -1);
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
                          move(s.id, 1);
                        }}
                        title="Bajar"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVisible(s.id);
                        }}
                        title={s.visible ? "Ocultar" : "Mostrar"}
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
                          removeSection(s.id);
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

          {/* Ajustes de la sección seleccionada */}
          {selected ? (
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <p className="text-sm font-semibold">
                Editar: {SECTION_LABELS[selected.type]}
              </p>
              <SectionNavSettings
                section={selected}
                onChange={(patch) => updateSectionMeta(selected.id, patch)}
              />
              {selected.type === "hero" ? (
                <HeroSettings
                  props={selected.props as HeroProps}
                  onChange={(patch) => updateProps(selected.id, patch)}
                />
              ) : selected.type === "vehiculos" ? (
                <VehiculosSettings
                  props={selected.props as VehiculosProps}
                  onChange={(patch) => updateProps(selected.id, patch)}
                />
              ) : selected.type === "contacto" ? (
                <ContactoSettings
                  props={selected.props as ContactoProps}
                  onChange={(patch) => updateProps(selected.id, patch)}
                />
              ) : selected.type === "consignaciones" ? (
                <ConsignacionesSettings
                  props={selected.props as ConsignacionesProps}
                  onChange={(patch) => updateProps(selected.id, patch)}
                />
              ) : (
                <VendeTuAutoSettings
                  props={selected.props as VendeTuAutoProps}
                  onChange={(patch) => updateProps(selected.id, patch)}
                />
              )}
            </div>
          ) : null}
        </div>

        {/* Panel derecho: preview en vivo (ocupa todo el alto disponible) */}
        <div className="flex min-h-[65vh] flex-1 flex-col overflow-hidden rounded-lg border bg-muted/30">
          <div className="flex shrink-0 items-center gap-2 border-b bg-card px-3 py-2 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
            <span className="ml-2">Vista previa en vivo</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <SitePreview
              sections={sections}
              themeSite={themeSite}
              siteName={siteName}
              logoUrl={logoUrl}
              whatsappPhone={site.whatsapp_phone}
              contactEmail={site.contact_email}
              contactPhone={site.contact_phone}
              address={site.address}
              vehicles={vehicles}
              vehiclesLoading={vehiclesLoading}
              selectedId={selectedId}
              onSelect={setSelectedId}
              preview
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSettings({
  props,
  onChange,
}: {
  props: HeroProps;
  onChange: (patch: Partial<HeroProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Título</Label>
        <Input
          value={props.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Subtítulo</Label>
        <Input
          value={props.subtitle}
          onChange={(e) => onChange({ subtitle: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Texto del botón</Label>
        <Input
          value={props.buttonText}
          onChange={(e) => onChange({ buttonText: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5 text-xs">
          <ImageIcon className="h-3.5 w-3.5" />
          Imagen de fondo
        </Label>
        <ImageField
          value={props.imageUrl}
          onChange={(url) => onChange({ imageUrl: url })}
        />
      </div>
    </div>
  );
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function ImageField({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (url: string) => void;
  compact?: boolean;
}) {
  const upload = useUploadSiteImage();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("La imagen supera el máximo de 10 MB");
      return;
    }
    upload.mutate(file, {
      onSuccess: (url) => {
        onChange(url);
        toast.success("Imagen subida");
      },
      onError: (e) =>
        toast.error("No se pudo subir la imagen", {
          description: e instanceof Error ? e.message : undefined,
        }),
    });
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative overflow-hidden rounded-md border bg-muted/30">
          <img
            src={value}
            alt="Imagen"
            className={`w-full object-contain ${compact ? "h-16" : "h-24 object-cover"}`}
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-1.5 top-1.5 rounded bg-black/60 p-1 text-white hover:bg-black/80"
            title="Quitar imagen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {upload.isPending ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="mr-2 h-3.5 w-3.5" />
        )}
        {value ? "Cambiar" : "Subir"}
      </Button>

      {!compact ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="o pegá una URL: https://..."
          className="text-xs"
        />
      ) : null}
    </div>
  );
}

function SectionNavSettings({
  section,
  onChange,
}: {
  section: SectionBlock;
  onChange: (patch: Partial<Pick<SectionBlock, "showInNav" | "navLabel">>) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-dashed p-3">
      <p className="text-xs font-semibold text-muted-foreground">Menú superior</p>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`nav-visible-${section.id}`} className="text-xs">
          Mostrar en menú
        </Label>
        <Switch
          id={`nav-visible-${section.id}`}
          checked={section.showInNav !== false}
          onCheckedChange={(v) => onChange({ showInNav: v })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Texto en el menú</Label>
        <Input
          value={section.navLabel ?? ""}
          onChange={(e) => onChange({ navLabel: e.target.value })}
          placeholder={SECTION_LABELS[section.type]}
        />
      </div>
    </div>
  );
}

function ContactoSettings({
  props,
  onChange,
}: {
  props: ContactoProps;
  onChange: (patch: Partial<ContactoProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Título</Label>
        <Input value={props.title} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Subtítulo</Label>
        <Input
          value={props.subtitle}
          onChange={(e) => onChange({ subtitle: e.target.value })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Teléfono, email y dirección se toman de la configuración del sitio (campos de contacto en
        la base de datos).
      </p>
    </div>
  );
}

function ConsignacionesSettings({
  props,
  onChange,
}: {
  props: ConsignacionesProps;
  onChange: (patch: Partial<ConsignacionesProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Título</Label>
        <Input value={props.title} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Subtítulo</Label>
        <Input value={props.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Descripción</Label>
        <Input
          value={props.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Texto del botón</Label>
        <Input
          value={props.buttonText}
          onChange={(e) => onChange({ buttonText: e.target.value })}
        />
      </div>
    </div>
  );
}

function VendeTuAutoSettings({
  props,
  onChange,
}: {
  props: VendeTuAutoProps;
  onChange: (patch: Partial<VendeTuAutoProps>) => void;
}) {
  const benefits = props.benefits?.length ? props.benefits : [""];
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Título</Label>
        <Input value={props.title} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Subtítulo</Label>
        <Input value={props.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Texto del botón</Label>
        <Input
          value={props.buttonText}
          onChange={(e) => onChange({ buttonText: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Beneficios (uno por línea)</Label>
        {benefits.map((b, i) => (
          <Input
            key={i}
            value={b}
            onChange={(e) => {
              const next = [...benefits];
              next[i] = e.target.value;
              onChange({ benefits: next });
            }}
            placeholder={`Beneficio ${i + 1}`}
          />
        ))}
        {benefits.length < 4 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ benefits: [...benefits, ""] })}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Agregar beneficio
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function VehiculosSettings({
  props,
  onChange,
}: {
  props: VehiculosProps;
  onChange: (patch: Partial<VehiculosProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Título de la sección</Label>
        <Input
          value={props.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Máximo de autos a mostrar</Label>
        <Input
          type="number"
          min={1}
          max={48}
          value={props.limit}
          onChange={(e) => onChange({ limit: Number(e.target.value) || 12 })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Los autos se cargan automáticamente desde tu inventario disponible.
      </p>
    </div>
  );
}
