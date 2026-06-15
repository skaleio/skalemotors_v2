import { useAuth } from "@/contexts/AuthContext";
import {
  stickyNotesService,
  type StickyNote,
  type StickyNoteColor,
  type StickyNotePatch,
} from "@/lib/services/stickyNotes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export const STICKY_NOTES_MAX = 30;
const NOTE_WIDTH = 248;
const COLOR_CYCLE: StickyNoteColor[] = ["yellow", "pink", "blue", "green", "purple", "orange"];

interface CreateNoteInput {
  id: string;
  color: StickyNoteColor;
  pos_x: number;
  pos_y: number;
  z_index: number;
}

export function useStickyNotes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["sticky-notes", user?.id];

  // Origen de la animación "nace desde el +": coords en pantalla del botón disparador.
  const [spawn, setSpawn] = useState<{ id: string; x: number; y: number } | null>(null);

  const { data: notes = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: () => stickyNotesService.getAll(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
    placeholderData: (previousData) => previousData,
  });

  const createNote = useMutation({
    mutationFn: (input: CreateNoteInput) => stickyNotesService.create(input),
    // Inserción optimista: la nota aparece al instante (con el id ya generado en el cliente),
    // así el efecto de "nacer del +" arranca con el click, sin esperar al server.
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<StickyNote[]>(queryKey);
      const now = new Date().toISOString();
      const optimistic: StickyNote = {
        id: input.id,
        tenant_id: user?.tenant_id ?? "",
        user_id: user?.id ?? "",
        content: "",
        color: input.color,
        pos_x: input.pos_x,
        pos_y: input.pos_y,
        z_index: input.z_index,
        created_at: now,
        updated_at: now,
      };
      queryClient.setQueryData<StickyNote[]>(queryKey, (old) => [...(old ?? []), optimistic]);
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  // Optimista: posición (drag), contenido (autosave) y color se reflejan sin esperar al server.
  const updateNote = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: StickyNotePatch }) =>
      stickyNotesService.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<StickyNote[]>(queryKey);
      queryClient.setQueryData<StickyNote[]>(queryKey, (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, ...updates } : n)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
  });

  const deleteNote = useMutation({
    mutationFn: (id: string) => stickyNotesService.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<StickyNote[]>(queryKey);
      queryClient.setQueryData<StickyNote[]>(queryKey, (old) =>
        (old ?? []).filter((n) => n.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
  });

  const maxZIndex = notes.reduce((max, n) => Math.max(max, n.z_index ?? 0), 0);

  const addNote = useCallback((origin?: { x: number; y: number }) => {
    if (notes.length >= STICKY_NOTES_MAX) {
      toast.warning(`Llegaste al máximo de ${STICKY_NOTES_MAX} notas`);
      return;
    }
    const id = crypto.randomUUID();
    if (origin) setSpawn({ id, x: origin.x, y: origin.y });
    const i = notes.length;
    // Destino: el centro de la pantalla, con una leve cascada para que varias no se solapen.
    const cascade = (i % 5) * 26;
    const centerX = window.innerWidth / 2 - NOTE_WIDTH / 2;
    const centerY = window.innerHeight / 2 - 130;
    createNote.mutate({
      id,
      color: COLOR_CYCLE[i % COLOR_CYCLE.length],
      pos_x: Math.max(8, Math.min(centerX + cascade, window.innerWidth - NOTE_WIDTH - 8)),
      pos_y: Math.max(8, centerY + cascade),
      z_index: maxZIndex + 1,
    });
  }, [notes.length, maxZIndex, createNote]);

  return {
    notes: notes as StickyNote[],
    loading,
    atLimit: notes.length >= STICKY_NOTES_MAX,
    maxZIndex,
    spawn,
    addNote,
    createNote,
    updateNote,
    deleteNote,
  };
}
