import { useReloadOnPopState } from "@/hooks/useReloadOnPopState";

/**
 * Componente que no renderiza nada; solo escucha el evento "atrás/adelante"
 * del navegador y recarga la página para mostrar datos actualizados.
 */
export default function ReloadOnPopState() {
  useReloadOnPopState();
  return null;
}
