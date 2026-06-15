import { cn } from "@/lib/utils";
import { STICKY_NOTES_MAX, useStickyNotes } from "@/hooks/useStickyNotes";
import type { StickyNoteColor } from "@/lib/services/stickyNotes";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Plus, StickyNote as StickyNoteIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { NOTE_W, StickyNote } from "./StickyNote";

const NOTES_BASE_Z = 40;
const VISIBLE_KEY = "skm-sticky-visible";
const COLOR_CYCLE: StickyNoteColor[] = ["yellow", "pink", "blue", "green", "purple", "orange"];

export function StickyNotesLayer() {
  const { notes, createNote, updateNote, deleteNote, maxZIndex, atLimit } = useStickyNotes();
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [visible, setVisible] = useState(() => localStorage.getItem(VISIBLE_KEY) !== "false");

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    localStorage.setItem(VISIBLE_KEY, String(visible));
  }, [visible]);

  const addNote = () => {
    if (atLimit) {
      toast.warning(`Llegaste al máximo de ${STICKY_NOTES_MAX} notas`);
      return;
    }
    const i = notes.length;
    createNote.mutate({
      color: COLOR_CYCLE[i % COLOR_CYCLE.length],
      pos_x: Math.min(40 + (i % 6) * 26, Math.max(8, viewport.w - NOTE_W)),
      pos_y: 120 + (i % 6) * 26,
      z_index: maxZIndex + 1,
    });
  };

  // z relativo acotado a [40, 48] para no tapar modales/toasts.
  const rankById = new Map(
    [...notes].sort((a, b) => a.z_index - b.z_index).map((n, idx) => [n.id, idx]),
  );

  return (
    <>
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: NOTES_BASE_Z }}>
        <AnimatePresence>
          {visible &&
            notes.map((note) => (
              <StickyNote
                key={note.id}
                note={note}
                viewport={viewport}
                z={NOTES_BASE_Z + Math.min(rankById.get(note.id) ?? 0, 8)}
                onUpdate={(updates) => updateNote.mutate({ id: note.id, updates })}
                onDelete={() => deleteNote.mutate(note.id)}
                onFocus={() => {
                  if ((note.z_index ?? 0) < maxZIndex) {
                    updateNote.mutate({ id: note.id, updates: { z_index: maxZIndex + 1 } });
                  }
                }}
              />
            ))}
        </AnimatePresence>
      </div>

      <div className="fixed bottom-6 left-6 flex flex-col items-center gap-2" style={{ zIndex: 45 }}>
        {notes.length > 0 && (
          <button
            type="button"
            aria-label={visible ? "Ocultar notas" : "Mostrar notas"}
            onClick={() => setVisible((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground shadow-md backdrop-blur transition hover:text-foreground"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        <motion.button
          type="button"
          aria-label="Nueva nota"
          onClick={addNote}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.94 }}
          className={cn(
            "group relative flex h-14 items-center gap-2 rounded-full pl-4 pr-5",
            "bg-gradient-to-br from-amber-300 to-amber-400 text-amber-950",
            "shadow-xl shadow-amber-500/40 ring-1 ring-amber-600/30",
          )}
        >
          {notes.length === 0 && (
            <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-amber-400/70" />
          )}
          <StickyNoteIcon className="h-6 w-6" />
          <span className="text-sm font-bold">Nota</span>
          <Plus className="h-4 w-4 opacity-70" />
        </motion.button>
      </div>
    </>
  );
}
