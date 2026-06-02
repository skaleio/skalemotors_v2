import { useMemo } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  buildTokens,
  defaultBrandColors,
  readableFg,
  THEME_OPTIONS,
  THEME_PRESETS,
  type ThemeId,
  type ThemeableSite,
} from "@/lib/website/theme";
import {
  isEmptyThemeCustom,
  RADIUS_PRESETS,
  radiusPresetId,
  type ThemeCustomKey,
  type ThemeCustomOverrides,
} from "@/lib/website/themeCustom";

interface DesignTokensEditorProps {
  theme: ThemeId;
  primaryColor: string;
  secondaryColor: string;
  themeCustom: ThemeCustomOverrides;
  onPrimaryColorChange: (hex: string) => void;
  onSecondaryColorChange: (hex: string) => void;
  onThemeCustomChange: (next: ThemeCustomOverrides) => void;
  onResetAll: () => void;
}

function ColorField({
  label,
  hint,
  value,
  presetValue,
  onChange,
  onClear,
}: {
  label: string;
  hint?: string;
  value: string | undefined;
  presetValue: string;
  onChange: (hex: string) => void;
  onClear: () => void;
}) {
  const display = value ?? presetValue;
  const customized = value != null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">{label}</Label>
        {customized ? (
          <button
            type="button"
            className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
            onClick={onClear}
          >
            Por defecto
          </button>
        ) : null}
      </div>
      {hint ? <p className="text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
      <div className="flex items-center gap-2">
        <Input
          type="color"
          value={display}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-11 shrink-0 cursor-pointer p-1"
        />
        <Input
          value={display}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 flex-1 font-mono text-xs"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

function PaletteStrip({ tokens }: { tokens: ReturnType<typeof buildTokens> }) {
  const swatches = [
    { label: "Fondo", color: tokens.colorBg },
    { label: "Tarjetas", color: tokens.colorSurface },
    { label: "Texto", color: tokens.colorFg },
    { label: "Botón", color: tokens.colorPrimary },
    { label: "Acento", color: tokens.colorSecondary },
  ];

  return (
    <div className="flex gap-1 overflow-hidden rounded-lg border p-1">
      {swatches.map((s) => (
        <div key={s.label} className="flex-1 space-y-1">
          <div
            className="h-8 w-full rounded-md border border-black/10"
            style={{ backgroundColor: s.color }}
            title={s.label}
          />
          <span className="block truncate text-center text-[9px] text-muted-foreground">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DesignTokensEditor({
  theme,
  primaryColor,
  secondaryColor,
  themeCustom,
  onPrimaryColorChange,
  onSecondaryColorChange,
  onThemeCustomChange,
  onResetAll,
}: DesignTokensEditorProps) {
  const preset = THEME_PRESETS[theme];
  const styleLabel = THEME_OPTIONS.find((t) => t.id === theme)?.label ?? theme;

  const effectiveSite: ThemeableSite = useMemo(
    () => ({
      theme,
      primary_color: primaryColor,
      secondary_color: secondaryColor || null,
      theme_custom: themeCustom,
    }),
    [theme, primaryColor, secondaryColor, themeCustom],
  );

  const tokens = useMemo(() => buildTokens(effectiveSite), [effectiveSite]);

  const patchCustom = (key: ThemeCustomKey, value: string | undefined) => {
    const next = { ...themeCustom };
    if (value == null) delete next[key];
    else next[key] = value;
    onThemeCustomChange(next);
  };

  const autoButtonText = themeCustom.colorPrimaryFg == null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Colores y apariencia</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Ajustá fondos, textos y botones. Los cambios se ven al instante en la vista previa.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-xs"
          onClick={onResetAll}
          title={`Restaurar paleta de ${styleLabel}`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <PaletteStrip tokens={tokens} />

      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Página
        </p>
        <ColorField
          label="Fondo de la página"
          hint="Color general detrás de todas las secciones"
          value={themeCustom.colorBg}
          presetValue={preset.colorBg}
          onChange={(hex) => patchCustom("colorBg", hex)}
          onClear={() => patchCustom("colorBg", undefined)}
        />
        <ColorField
          label="Fondo de tarjetas y bloques"
          value={themeCustom.colorSurface}
          presetValue={preset.colorSurface}
          onChange={(hex) => patchCustom("colorSurface", hex)}
          onClear={() => patchCustom("colorSurface", undefined)}
        />
        <ColorField
          label="Texto principal"
          value={themeCustom.colorFg}
          presetValue={preset.colorFg}
          onChange={(hex) => patchCustom("colorFg", hex)}
          onClear={() => patchCustom("colorFg", undefined)}
        />
        <ColorField
          label="Texto secundario"
          hint="Subtítulos, descripciones y etiquetas"
          value={themeCustom.colorMuted}
          presetValue={preset.colorMuted}
          onChange={(hex) => patchCustom("colorMuted", hex)}
          onClear={() => patchCustom("colorMuted", undefined)}
        />
        <ColorField
          label="Bordes y divisiones"
          value={themeCustom.colorBorder}
          presetValue={preset.colorBorder}
          onChange={(hex) => patchCustom("colorBorder", hex)}
          onClear={() => patchCustom("colorBorder", undefined)}
        />
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Botones y acentos
        </p>
        <ColorField
          label="Color del botón principal"
          hint="CTAs, enlaces destacados y precios"
          value={primaryColor}
          presetValue={preset.colorPrimary}
          onChange={onPrimaryColorChange}
          onClear={() => onPrimaryColorChange(preset.colorPrimary)}
        />
        <div className="flex items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-2">
          <div>
            <Label className="text-xs">Texto del botón automático</Label>
            <p className="text-[10px] text-muted-foreground">
              Negro o blanco según contraste
            </p>
          </div>
          <Switch
            checked={autoButtonText}
            onCheckedChange={(on) => {
              if (on) patchCustom("colorPrimaryFg", undefined);
              else patchCustom("colorPrimaryFg", readableFg(primaryColor));
            }}
          />
        </div>
        {!autoButtonText ? (
          <ColorField
            label="Texto del botón"
            value={themeCustom.colorPrimaryFg}
            presetValue={readableFg(primaryColor)}
            onChange={(hex) => patchCustom("colorPrimaryFg", hex)}
            onClear={() => patchCustom("colorPrimaryFg", undefined)}
          />
        ) : null}
        <ColorField
          label="Color de acento secundario"
          hint="Detalles, hover y elementos de apoyo"
          value={secondaryColor || undefined}
          presetValue={preset.colorSecondary}
          onChange={onSecondaryColorChange}
          onClear={() => onSecondaryColorChange("")}
        />
      </div>

      <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Forma
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs">Esquinas de tarjetas y botones</Label>
          <Select
            value={radiusPresetId(themeCustom.radius ?? preset.radius)}
            onValueChange={(id) => {
              const hit = RADIUS_PRESETS.find((p) => p.id === id);
              if (!hit) return;
              if (hit.value === preset.radius) patchCustom("radius", undefined);
              else patchCustom("radius", hit.value);
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Elegir" />
            </SelectTrigger>
            <SelectContent>
              {RADIUS_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {themeCustom.radius &&
          !RADIUS_PRESETS.some((p) => p.value === themeCustom.radius) ? (
            <Input
              value={themeCustom.radius}
              onChange={(e) => patchCustom("radius", e.target.value)}
              className="font-mono text-xs"
              placeholder="0.75rem"
            />
          ) : null}
          {themeCustom.radius ? (
            <button
              type="button"
              className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => patchCustom("radius", undefined)}
            >
              Esquinas por defecto del estilo
            </button>
          ) : null}
        </div>
      </div>

      {!isEmptyThemeCustom(themeCustom) ? (
        <p className="text-[10px] text-muted-foreground">
          Tenés colores personalizados sobre <strong>{styleLabel}</strong>. «Reset» vuelve a la
          paleta base del estilo.
        </p>
      ) : null}
    </div>
  );
}

export function resetDesignToThemePreset(themeId: ThemeId): {
  primaryColor: string;
  secondaryColor: string;
  themeCustom: ThemeCustomOverrides;
} {
  const { primary, secondary } = defaultBrandColors(themeId);
  return {
    primaryColor: primary,
    secondaryColor: secondary,
    themeCustom: {},
  };
}
