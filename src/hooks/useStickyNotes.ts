import { useAuth } from "@/contexts/AuthContext";
import {
  stickyNotesService,
  type StickyNote,
  type StickyNoteColor,
  type StickyNoteUpdate,
} from "@/lib/services/stickyNotes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const STICKY_NOTES_MAX = 30;

interface CreateNoteInput {
  color: StickyNoteColor;
  pos_x: number;
  pos_y: number;
  z_index: number;
}

export function useStickyNotes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["sticky-notes", user?.id];

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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  // Optimista: posición (drag), contenido (autosave) y color se reflejan sin esperar al server.
  const updateNote = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: StickyNoteUpdate }) =>
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

  return {
    notes: notes as StickyNote[],
    loading,
    atLimit: notes.length >= STICKY_NOTES_MAX,
    maxZIndex,
    createNote,
    updateNote,
    deleteNote,
  };
}
