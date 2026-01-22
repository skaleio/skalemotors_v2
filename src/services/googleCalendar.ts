/**
 * Servicio de integración con Google Calendar API
 * 
 * Para usar esta integración:
 * 1. Crear un proyecto en Google Cloud Console
 * 2. Habilitar Google Calendar API
 * 3. Crear credenciales OAuth 2.0
 * 4. Agregar las variables de entorno:
 *    - VITE_GOOGLE_CLIENT_ID
 *    - VITE_GOOGLE_API_KEY
 */

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
}

class GoogleCalendarService {
  private CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  private API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
  private DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
  private SCOPES = "https://www.googleapis.com/auth/calendar.events";
  private tokenClient: any = null;
  private gapiInited = false;
  private gisInited = false;

  /**
   * Verificar si las credenciales están configuradas
   */
  isConfigured(): boolean {
    return !!(this.CLIENT_ID && this.API_KEY);
  }

  /**
   * Inicializar Google API
   */
  async initialize(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("Google Calendar API no está configurado. Verifica las variables de entorno VITE_GOOGLE_CLIENT_ID y VITE_GOOGLE_API_KEY.");
    }

    return new Promise((resolve, reject) => {
      // Cargar script de GAPI
      const gapiScript = document.createElement("script");
      gapiScript.src = "https://apis.google.com/js/api.js";
      gapiScript.async = true;
      gapiScript.defer = true;
      gapiScript.onload = () => {
        (window as any).gapi.load("client", async () => {
          try {
            await (window as any).gapi.client.init({
              apiKey: this.API_KEY,
              discoveryDocs: this.DISCOVERY_DOCS,
            });
            this.gapiInited = true;
            if (this.gisInited) resolve();
          } catch (error) {
            reject(error);
          }
        });
      };
      document.body.appendChild(gapiScript);

      // Cargar script de GIS (Google Identity Services)
      const gisScript = document.createElement("script");
      gisScript.src = "https://accounts.google.com/gsi/client";
      gisScript.async = true;
      gisScript.defer = true;
      gisScript.onload = () => {
        this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: this.CLIENT_ID,
          scope: this.SCOPES,
          callback: "", // Se definirá más tarde
        });
        this.gisInited = true;
        if (this.gapiInited) resolve();
      };
      document.body.appendChild(gisScript);
    });
  }

  /**
   * Autenticar con Google
   */
  async authenticate(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.gapiInited || !this.gisInited) {
        reject(new Error("Google API no inicializada"));
        return;
      }

      try {
        this.tokenClient.callback = async (resp: any) => {
          if (resp.error !== undefined) {
            reject(resp);
            return;
          }
          resolve(true);
        };

        if ((window as any).gapi.client.getToken() === null) {
          this.tokenClient.requestAccessToken({ prompt: "consent" });
        } else {
          this.tokenClient.requestAccessToken({ prompt: "" });
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Verificar si está autenticado
   */
  isAuthenticated(): boolean {
    return (window as any).gapi?.client?.getToken() !== null;
  }

  /**
   * Cerrar sesión
   */
  async signOut(): Promise<void> {
    const token = (window as any).gapi.client.getToken();
    if (token !== null) {
      (window as any).google.accounts.oauth2.revoke(token.access_token);
      (window as any).gapi.client.setToken("");
    }
  }

  /**
   * Listar eventos del calendario
   */
  async listEvents(
    timeMin: Date,
    timeMax: Date,
    maxResults: number = 10
  ): Promise<GoogleCalendarEvent[]> {
    try {
      const response = await (window as any).gapi.client.calendar.events.list({
        calendarId: "primary",
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        showDeleted: false,
        singleEvents: true,
        maxResults: maxResults,
        orderBy: "startTime",
      });

      return response.result.items || [];
    } catch (error) {
      console.error("Error al listar eventos:", error);
      throw error;
    }
  }

  /**
   * Crear evento en el calendario
   */
  async createEvent(event: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    location?: string;
    attendees?: string[];
  }): Promise<GoogleCalendarEvent> {
    try {
      const calendarEvent = {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: {
          dateTime: event.start.toISOString(),
          timeZone: "America/Santiago",
        },
        end: {
          dateTime: event.end.toISOString(),
          timeZone: "America/Santiago",
        },
        attendees: event.attendees?.map((email) => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },
            { method: "popup", minutes: 30 },
          ],
        },
      };

      const response = await (window as any).gapi.client.calendar.events.insert({
        calendarId: "primary",
        resource: calendarEvent,
      });

      return response.result;
    } catch (error) {
      console.error("Error al crear evento:", error);
      throw error;
    }
  }

  /**
   * Actualizar evento en el calendario
   */
  async updateEvent(
    eventId: string,
    event: {
      summary?: string;
      description?: string;
      start?: Date;
      end?: Date;
      location?: string;
    }
  ): Promise<GoogleCalendarEvent> {
    try {
      const updateData: any = {};
      if (event.summary) updateData.summary = event.summary;
      if (event.description) updateData.description = event.description;
      if (event.location) updateData.location = event.location;
      if (event.start) {
        updateData.start = {
          dateTime: event.start.toISOString(),
          timeZone: "America/Santiago",
        };
      }
      if (event.end) {
        updateData.end = {
          dateTime: event.end.toISOString(),
          timeZone: "America/Santiago",
        };
      }

      const response = await (window as any).gapi.client.calendar.events.patch({
        calendarId: "primary",
        eventId: eventId,
        resource: updateData,
      });

      return response.result;
    } catch (error) {
      console.error("Error al actualizar evento:", error);
      throw error;
    }
  }

  /**
   * Eliminar evento del calendario
   */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      await (window as any).gapi.client.calendar.events.delete({
        calendarId: "primary",
        eventId: eventId,
      });
    } catch (error) {
      console.error("Error al eliminar evento:", error);
      throw error;
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
