import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  THEME_OPTIONS,
  THEME_PRESETS,
  type ThemeId,
  type ThemeLayout,
} from "@/lib/website/theme";

interface TemplatePickerProps {
  value: ThemeId;
  onChange: (id: ThemeId) => void;
  className?: string;
}

function TemplateMockup({ layout, themeId }: { layout: ThemeLayout; themeId: ThemeId }) {
  const t = THEME_PRESETS[themeId];

  if (layout === "luxury") {
    const glow =
      themeId === "miami"
        ? "radial-gradient(ellipse 80% 60% at 70% 20%, rgba(236,72,153,0.45), transparent 55%)"
        : "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(200,162,74,0.35), transparent 60%)";

    return (
      <div
        className="relative h-full w-full overflow-hidden"
        style={{ background: t.colorBg }}
      >
        <div className="absolute inset-0 opacity-90" style={{ background: glow }} />
        <div
          className="absolute inset-x-0 top-0 flex h-[14%] items-center justify-between px-[8%]"
          style={{ backgroundColor: `${t.colorSurface}ee` }}
        >
          <div className="h-[35%] w-[18%] rounded-sm" style={{ background: t.colorFg, opacity: 0.9 }} />
          <div className="flex gap-[3%]">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[22%] w-[10%] rounded-full"
                style={{ background: t.colorMuted, opacity: 0.35 }}
              />
            ))}
          </div>
        </div>
        <div className="absolute inset-x-[8%] top-[22%] space-y-[6%]">
          <div className="h-[8%] w-[55%] rounded-sm" style={{ background: t.colorFg, opacity: 0.95 }} />
          <div className="h-[4%] w-[40%] rounded-sm" style={{ background: t.colorMuted, opacity: 0.5 }} />
          <div
            className="mt-[4%] h-[7%] w-[28%] rounded-md"
            style={{ background: t.colorPrimary }}
          />
        </div>
        <div className="absolute inset-x-[8%] bottom-[28%] flex gap-[4%]">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[18%] flex-1 rounded-sm"
              style={{
                background: t.colorSurface,
                border: `1px solid ${t.colorBorder}`,
              }}
            />
          ))}
        </div>
        <div
          className="absolute inset-x-0 bottom-0 h-[12%]"
          style={{
            background: `linear-gradient(180deg, transparent, ${t.colorPrimary}22)`,
          }}
        />
      </div>
    );
  }

  if (layout === "classic") {
    return (
      <div className="relative h-full w-full" style={{ background: t.colorBg }}>
        <div className="flex h-[16%] flex-col items-center justify-center gap-[5%] border-b px-[10%]" style={{ borderColor: t.colorBorder }}>
          <div className="h-[28%] w-[22%] rounded-sm" style={{ background: t.colorFg, opacity: 0.85 }} />
          <div className="flex gap-[6%]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[18%] w-[14%] rounded-sm" style={{ background: t.colorMuted, opacity: 0.35 }} />
            ))}
          </div>
        </div>
        <div className="px-[12%] pt-[10%] text-center">
          <div className="mx-auto h-[7%] w-[70%] rounded-sm" style={{ background: t.colorFg }} />
          <div className="mx-auto mt-[5%] h-[3%] w-[50%] rounded-sm" style={{ background: t.colorMuted, opacity: 0.45 }} />
          <div
            className="mx-auto mt-[8%] h-[5%] w-[24%] rounded-sm"
            style={{ background: t.colorPrimary }}
          />
        </div>
        <div className="absolute inset-x-[10%] bottom-[12%] grid grid-cols-2 gap-[5%]">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="aspect-[4/3] rounded-sm"
              style={{
                background: t.colorSurface,
                border: `1px solid ${t.colorBorder}`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // modern
  return (
    <div className="relative h-full w-full" style={{ background: t.colorBg }}>
      <div
        className="flex h-[14%] items-center justify-between border-b px-[8%]"
        style={{ borderColor: t.colorBorder, background: t.colorBg }}
      >
        <div className="h-[40%] w-[16%] rounded-md" style={{ background: t.colorPrimary, opacity: 0.85 }} />
        <div className="flex gap-[4%]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[22%] w-[12%] rounded-full bg-slate-200/80" style={{ background: t.colorBorder }} />
          ))}
        </div>
      </div>
      <div className="flex h-[42%] gap-[6%] px-[8%] pt-[8%]">
        <div className="flex w-[48%] flex-col justify-center gap-[8%]">
          <div className="h-[12%] w-full rounded-sm" style={{ background: t.colorFg }} />
          <div className="h-[6%] w-[80%] rounded-sm" style={{ background: t.colorMuted, opacity: 0.4 }} />
          <div className="h-[10%] w-[45%] rounded-full" style={{ background: t.colorPrimary }} />
        </div>
        <div
          className="flex-1 rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${t.colorSurface}, ${t.colorBorder})`,
          }}
        />
      </div>
      <div className="absolute inset-x-[8%] bottom-[14%] flex gap-[4%]">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[20%] flex-1 rounded-md"
            style={{ background: t.colorSurface, boxShadow: t.shadow }}
          />
        ))}
      </div>
    </div>
  );
}

export function TemplatePicker({ value, onChange, className }: TemplatePickerProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {THEME_OPTIONS.map((option) => {
        const active = value === option.id;
        const preset = THEME_PRESETS[option.id];

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            title={option.description}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
              active
                ? "border-violet-500/80 shadow-md shadow-violet-500/10"
                : "border-border/80 hover:border-muted-foreground/30 hover:shadow-sm",
            )}
          >
            <div
              className="relative aspect-[5/3] w-full overflow-hidden"
              style={{
                boxShadow: active ? `inset 0 0 0 1px ${preset.colorPrimary}40` : undefined,
              }}
            >
              <TemplateMockup layout={option.layout} themeId={option.id} />
              {active ? (
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              ) : (
                <span
                  className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/[0.03]"
                  aria-hidden
                />
              )}
            </div>

            <div className="space-y-0.5 bg-card px-3 py-2.5">
              <span className="block text-sm font-semibold tracking-tight text-foreground">
                {option.label}
              </span>
              <span className="block text-[11px] leading-snug text-muted-foreground">
                {option.tagline}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
