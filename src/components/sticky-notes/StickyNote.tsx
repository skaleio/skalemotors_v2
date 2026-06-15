import { cn } from "@/lib/utils";
import type { StickyNote as StickyNoteRow, StickyNoteColor } from "@/lib/services/stickyNotes";
import { animate, AnimatePresence, motion, useDragControls, useMotionValue } from "framer-motion";
import { Check, GripHorizontal, Maximize2, Minus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const NOTE_W = 248;
export const NOTE_H = 248;

const PALETTE: Record<StickyNoteColor, { sheet: string; bar: string; text: string; dot: string }> = {
  yellow: { sheet: "from-amber-100 to-amber-200", bar: "bg-amber-300/50", text: "text-amber-950", dot: "bg-amber-300" },
  pink: { sheet: "from-rose-100 to-rose-200", bar: "bg-rose-300/50", text: "text-rose-950", dot: "bg-rose-300" },
  blue: { sheet: "from-sky-100 to-sky-200", bar: "bg-sky-300/50", text: "text-sky-950", dot: "bg-sky-300" },
  green: { sheet: "from-emerald-100 to-emerald-200", bar: "bg-emerald-300/50", text: "text-emerald-950", dot: "bg-emerald-300" },
  purple: { sheet: "from-violet-100 to-violet-200", bar: "bg-violet-300/50", text: "text-violet-950", dot: "bg-violet-300" },
  orange: { sheet: "from-orange-100 to-orange-200", bar: "bg-orange-300/50", text: "text-orange-950", dot: "bg-orange-300" },
};

const COLORS = Object.keys(PALETTE) as StickyNoteColor[];
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function tiltFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h % 7) - 3) * 0.6; // -1.8° .. 1.8°
}

interface StickyNoteProps {
  note: StickyNoteRow;
  viewport: { w: number; h: number };
  z: number;
  origin?: { x: number; y: number };
  onUpdate: (updates: Partial<Pick<StickyNoteRow, "content" | "color" | "pos_x" | "pos_y" | "z_index">>) => void;
  onDelete: () => void;
  onFocus: () => void;
}

export function StickyNote({ note, viewport, z, origin, onUpdate, onDelete, onFocus }: StickyNoteProps) {
  const controls = useDragControls();
  const x = useMotionValue(origin ? origin.x : note.pos_x);
  const y = useMotionValue(origin ? origin.y : note.pos_y);
  const [content, setContent] = useState(note.content);
  const [color, setColor] = useState<StickyNoteColor>(note.color);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const palette = PALETTE[color];

  // Mantener dentro del viewport cuando cambia el tamaño de pantalla.
  useEffect(() => {
    x.set(clamp(x.get(), 8, Math.max(8, viewport.w - NOTE_W)));
    y.set(clamp(y.get(), 8, Math.max(8, viewport.h - NOTE_H)));
  }, [viewport.w, viewport.h, x, y]);

  // "Nace desde el +": arranca en el origen (el botón) y vuela hasta su posición.
  useEffect(() => {
    if (!origin) return;
    x.set(origin.x);
    y.set(origin.y);
    const ax = animate(x, note.pos_x, { type: "spring", stiffness: 240, damping: 26 });
    const ay = animate(y, note.pos_y, { type: "spring", stiffness: 240, damping: 26 });
    return () => {
      ax.stop();
      ay.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = (value: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (value !== note.content) onUpdate({ content: value });
  };

  const handleChange = (value: string) => {
    setContent(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      if (value !== note.content) onUpdate({ content: value });
    }, 600);
  };

  const pickColor = (c: StickyNoteColor) => {
    setColor(c);
    if (c !== note.color) onUpdate({ color: c });
  };

  return (
    <motion.div
      drag
      dragControls={controls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0}
      onPointerDown={onFocus}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => {
        setDragging(false);
        const nx = clamp(x.get(), 8, Math.max(8, viewport.w - NOTE_W));
        const ny = clamp(y.get(), 8, Math.max(8, viewport.h - NOTE_H));
        x.set(nx);
        y.set(ny);
        onUpdate({ pos_x: nx, pos_y: ny });
      }}
      style={{ x, y, zIndex: z, width: NOTE_W }}
      className="pointer-events-auto fixed left-0 top-0"
      initial={
        origin
          ? { scale: 0.1, opacity: 0, rotate: 0 }
          : { scale: 0.6, opacity: 0, rotate: tiltFromId(note.id) - 6 }
      }
      animate={{ scale: 1, opacity: 1, rotate: dragging ? 0 : tiltFromId(note.id) }}
      exit={{ scale: 0.5, opacity: 0, rotate: 8, transition: { duration: 0.18 } }}
      whileDrag={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
    >
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-sm bg-gradient-to-br shadow-[0_10px_30px_-8px_rgba(0,0,0,0.35)]",
          minimized ? "h-auto" : "h-[248px]",
          palette.sheet,
          dragging && "shadow-[0_24px_50px_-12px_rgba(0,0,0,0.45)]",
        )}
      >
        <div
          onPointerDown={(e) => controls.start(e)}
          className={cn("flex cursor-grab items-center gap-1 px-2 py-1.5 active:cursor-grabbing", palette.bar)}
        >
          <GripHorizontal className={cn("h-4 w-4 shrink-0 opacity-50", palette.text)} />
          {minimized && (
            <span className={cn("truncate text-xs font-medium", palette.text)}>
              {content.trim() || "Nota vacía"}
            </span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {!minimized &&
              COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => pickColor(c)}
                className={cn(
                  "h-3.5 w-3.5 rounded-full ring-1 ring-black/10 transition-transform hover:scale-125",
                  PALETTE[c].dot,
                  c === color && "ring-2 ring-black/40",
                )}
              />
            ))}
            <button
              type="button"
              aria-label={minimized ? "Expandir nota" : "Minimizar nota"}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                if (!minimized) flush(content);
                setMinimized((m) => !m);
              }}
              className={cn("rounded p-0.5 opacity-60 transition-opacity hover:opacity-100", palette.text)}
            >
              {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
            </button>
            <AnimatePresence mode="wait" initial={false}>
              {confirmDelete ? (
                <motion.span
                  key="confirm"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex items-center gap-0.5"
                >
                  <button
                    type="button"
                    aria-label="Confirmar borrado"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={onDelete}
                    className="rounded p-0.5 text-red-700 hover:bg-red-500/20"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Cancelar"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setConfirmDelete(false)}
                    className={cn("rounded p-0.5 hover:bg-black/10", palette.text)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.span>
              ) : (
                <button
                  key="trash"
                  type="button"
                  aria-label="Borrar nota"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => (content.trim() ? setConfirmDelete(true) : onDelete())}
                  className={cn("rounded p-0.5 opacity-60 transition-opacity hover:opacity-100", palette.text)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </AnimatePresence>
          </div>
        </div>
        {!minimized && (
          <textarea
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => flush(content)}
            placeholder="Escribe algo…"
            className={cn(
              "flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-snug outline-none placeholder:opacity-40",
              palette.text,
            )}
          />
        )}
      </div>
    </motion.div>
  );
}
