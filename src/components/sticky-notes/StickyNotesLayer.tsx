import { useStickyNotes } from "@/hooks/useStickyNotes";
import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { StickyNote } from "./StickyNote";

const NOTES_BASE_Z = 40;

export function StickyNotesLayer() {
  const { notes, updateNote, deleteNote, maxZIndex } = useStickyNotes();
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // z relativo acotado a [40, 48] para no tapar modales/toasts.
  const rankById = new Map(
    [...notes].sort((a, b) => a.z_index - b.z_index).map((n, idx) => [n.id, idx]),
  );

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: NOTES_BASE_Z }}>
      <AnimatePresence>
        {notes.map((note) => (
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
  );
}
