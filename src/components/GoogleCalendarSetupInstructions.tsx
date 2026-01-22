import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, AlertCircle, MessageCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface GoogleCalendarSetupInstructionsProps {
  onClose?: () => void;
  onContactSupport?: () => void;
}

export default function GoogleCalendarSetupInstructions({ onClose, onContactSupport }: GoogleCalendarSetupInstructionsProps) {
  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Configuración de Google Calendar
        </CardTitle>
        <CardDescription>
          Para usar la integración con Google Calendar, necesitas configurar las credenciales de API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Variables de entorno no configuradas</AlertTitle>
          <AlertDescription>
            No se encontraron las variables de entorno necesarias para Google Calendar API.
            Sigue los pasos a continuación para configurarlas.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Pasos para configurar:</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="font-bold min-w-[24px]">1.</span>
              <div>
                Ve a{" "}
                <a
                  href="https://console.cloud.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Google Cloud Console
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="font-bold min-w-[24px]">2.</span>
              <span>Crea un nuevo proyecto o selecciona uno existente</span>
            </div>

            <div className="flex items-start gap-2">
              <span className="font-bold min-w-[24px]">3.</span>
              <span>Habilita <strong>Google Calendar API</strong> en la biblioteca de APIs</span>
            </div>

            <div className="flex items-start gap-2">
              <span className="font-bold min-w-[24px]">4.</span>
              <span>Crea credenciales <strong>OAuth 2.0 Client ID</strong> y <strong>API Key</strong></span>
            </div>

            <div className="flex items-start gap-2">
              <span className="font-bold min-w-[24px]">5.</span>
              <div>
                <p>Agrega las siguientes variables al archivo <code className="bg-muted px-2 py-1 rounded">.env</code>:</p>
                <div className="bg-muted p-3 rounded-md mt-2 font-mono text-xs">
                  <div>VITE_GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com</div>
                  <div>VITE_GOOGLE_API_KEY=tu_api_key</div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="font-bold min-w-[24px]">6.</span>
              <span>Reinicia el servidor de desarrollo</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => window.open("/GOOGLE_CALENDAR_SETUP.md", "_blank")}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Ver guía completa
            </Button>
            {onContactSupport && (
              <Button
                variant="outline"
                onClick={onContactSupport}
                className="flex items-center gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
              >
                <MessageCircle className="h-4 w-4" />
                Contactar soporte
              </Button>
            )}
          </div>
          {onClose && (
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
