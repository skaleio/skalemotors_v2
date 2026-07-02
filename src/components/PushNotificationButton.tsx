import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Botón para activar/desactivar las notificaciones push en ESTE dispositivo.
 * Se oculta si el navegador no soporta push (evita ruido en desktop sin soporte).
 */
export function PushNotificationButton({ size = "sm" }: { size?: "sm" | "default" }) {
  const { state, busy, supported, configured, subscribe, unsubscribe } = usePushNotifications();

  if (!supported || state === "loading") return null;

  if (state === "denied") {
    return (
      <Button
        variant="outline"
        size={size}
        disabled
        title="Bloqueaste las notificaciones. Habilitalas en los permisos del navegador para este sitio."
      >
        <BellOff className="mr-2 h-4 w-4" />
        Notificaciones bloqueadas
      </Button>
    );
  }

  if (!configured) {
    return (
      <Button variant="outline" size={size} disabled title="Push no configurado en este entorno (falta VAPID).">
        <BellOff className="mr-2 h-4 w-4" />
        Push no disponible
      </Button>
    );
  }

  const subscribed = state === "subscribed";

  const handleClick = async () => {
    try {
      if (subscribed) {
        await unsubscribe();
        toast.success("Notificaciones desactivadas en este dispositivo");
      } else {
        await subscribe();
        toast.success("Notificaciones activadas en este dispositivo");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo cambiar el estado de las notificaciones",
      );
    }
  };

  return (
    <Button
      variant={subscribed ? "outline" : "default"}
      size={size}
      onClick={handleClick}
      disabled={busy}
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : subscribed ? (
        <BellRing className="mr-2 h-4 w-4" />
      ) : (
        <Bell className="mr-2 h-4 w-4" />
      )}
      {subscribed ? "Notificaciones activas" : "Activar notificaciones"}
    </Button>
  );
}
