/**
 * Endpoint MCP remoto (Streamable HTTP, stateless) para conectar Skale Motors a Claude.
 *
 * La UI de conectores de Claude no permite setear API key ni headers: solo OAuth o
 * sin-auth. Por eso la clave viaja embebida en la URL del conector como query
 * (?k=<key>&b=<branch>); Claude lo trata como servidor sin-auth y este endpoint valida
 * la clave reenviando cada tool al endpoint ya en producción /api/n8n-lead-ingest
 * (que normaliza el teléfono chileno, maneja idempotencia y valida tenant↔sucursal).
 *
 * URL del conector que pega el usuario en Claude:
 *   https://<host>/api/mcp?k=<lead_ingest_key_de_tenant>&b=<branch_id_default>
 *
 * La clave es por TENANT (branch_id NULL en lead_ingest_keys); `b` fija la sucursal
 * por defecto donde caen los leads cargados desde Claude.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

type ReqWithBody = IncomingMessage & { body?: unknown };

/** POST al endpoint de ingesta ya en prod. Devuelve { ok, status, data }. */
async function postIngest(
  ingestUrl: string,
  apiKey: string,
  branchId: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({ ...payload, branch_id: branchId }),
  });

  let json: any;
  try {
    json = await res.json();
  } catch {
    json = { ok: false, error: `Respuesta no-JSON (HTTP ${res.status})` };
  }
  return { ok: res.ok && json?.ok !== false, status: res.status, data: json };
}

function textResult(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], isError };
}

function describeLead(data: any): string {
  const lead = data?.data ?? {};
  const accion = data?.created ? "creado" : "actualizado";
  const parts = [
    `Lead ${accion} ✓`,
    lead.id ? `id: ${lead.id}` : null,
    lead.full_name ? `nombre: ${lead.full_name}` : null,
    lead.phone ? `teléfono: ${lead.phone}` : null,
    lead.status ? `estado: ${lead.status}` : null,
  ].filter(Boolean);
  if (data?.appointment?.id) {
    parts.push(`cita agendada: ${data.appointment.scheduled_at}`);
  }
  return parts.join(" · ");
}

const leadShape = {
  full_name: z.string().describe("Nombre completo del lead. Requerido."),
  phone: z
    .string()
    .describe(
      "Teléfono. Acepta formato libre chileno; el servidor lo normaliza a +56. Requerido.",
    ),
  email: z.string().email().optional().describe("Correo electrónico."),
  rut: z.string().optional().describe("RUT chileno."),
  region: z.string().optional().describe("Región / comuna del lead."),
  vehicle_interest: z
    .string()
    .optional()
    .describe("Vehículo o tipo de vehículo que busca (ej. 'SUV', 'Toyota Hilux')."),
  budget: z
    .string()
    .optional()
    .describe("Presupuesto en CLP, como texto (ej. '15.000.000')."),
  payment_type: z
    .string()
    .optional()
    .describe("Forma de pago (ej. 'contado', 'financiamiento', 'crédito')."),
  source: z
    .enum([
      "web",
      "referido",
      "walk_in",
      "telefono",
      "redes_sociales",
      "evento",
      "otro",
      "whatsapp",
    ])
    .optional()
    .describe("Origen del lead. Por defecto 'whatsapp'."),
  status: z
    .enum([
      "nuevo",
      "no_contesta",
      "en_seguimiento",
      "buscando_vehiculo",
      "contactado",
      "interesado",
      "cotizando",
      "agendado",
      "negociando",
      "en_espera",
      "vendido",
      "perdido",
      "para_cierre",
      "cancelado",
    ])
    .optional()
    .describe("Estado en el embudo. Por defecto 'nuevo'."),
  priority: z
    .enum(["baja", "media", "alta"])
    .optional()
    .describe("Prioridad. Por defecto 'alta'."),
  notes: z.string().optional().describe("Notas u observaciones libres."),
  assigned_to_email: z
    .string()
    .email()
    .optional()
    .describe("Email del vendedor al que asignar el lead, si se conoce."),
};

const appointmentShape = {
  ...leadShape,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Fecha de la cita en formato YYYY-MM-DD. Requerido."),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .describe("Hora de la cita en formato HH:mm (24h). Requerido."),
  title: z.string().optional().describe("Título de la cita."),
  description: z.string().optional().describe("Descripción / motivo de la cita."),
};

/** Construye un McpServer con las tools scopeadas a (apiKey, branchId, ingestUrl). */
function buildServer(ingestUrl: string, apiKey: string, branchId: string): McpServer {
  const server = new McpServer({ name: "skalemotors-lead-ingest", version: "1.0.0" });

  server.registerTool(
    "crear_lead",
    {
      description:
        "Crea (o actualiza si el teléfono ya existe) un lead en Skale Motors con sus datos. " +
        "Usar cuando llega un contacto nuevo y hay que cargarlo en el CRM.",
      inputSchema: leadShape,
    },
    async (args) => {
      try {
        const result = await postIngest(ingestUrl, apiKey, branchId, args);
        if (!result.ok) {
          return textResult(
            `No se pudo crear el lead (HTTP ${result.status}): ${
              result.data?.error ?? "error desconocido"
            }`,
            true,
          );
        }
        return textResult(describeLead(result.data));
      } catch (err: any) {
        return textResult(`Error de red al crear el lead: ${err.message}`, true);
      }
    },
  );

  server.registerTool(
    "agendar_cita",
    {
      description:
        "Crea o actualiza el lead y agenda una cita para él en el mismo paso. " +
        "Usar cuando el contacto ya quiere venir a la sucursal en una fecha/hora concreta.",
      inputSchema: appointmentShape,
    },
    async (args) => {
      try {
        const result = await postIngest(ingestUrl, apiKey, branchId, args);
        if (!result.ok) {
          return textResult(
            `No se pudo agendar la cita (HTTP ${result.status}): ${
              result.data?.error ?? "error desconocido"
            }`,
            true,
          );
        }
        return textResult(describeLead(result.data));
      } catch (err: any) {
        return textResult(`Error de red al agendar la cita: ${err.message}`, true);
      }
    },
  );

  return server;
}

function selfIngestUrl(req: IncomingMessage): string {
  const envUrl = process.env.MCP_INGEST_URL?.trim();
  if (envUrl) return envUrl;
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
  return `${proto}://${host}/api/n8n-lead-ingest`;
}

export default async function handler(req: ReqWithBody, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version",
  );

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url ?? "", "http://localhost");
  const apiKey = url.searchParams.get("k")?.trim() || "";
  const branchId = url.searchParams.get("b")?.trim() || "";

  if (!apiKey || !branchId) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error:
          "Faltan parámetros en la URL del conector (k=clave, b=sucursal). " +
          "Regenerá la conexión desde Configuración → Conectar con Claude.",
      }),
    );
    return;
  }

  const server = buildServer(selfIngestUrl(req), apiKey, branchId);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req as IncomingMessage, res, req.body);
  } catch (err: any) {
    console.error("[api/mcp] error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Internal MCP server error" }));
    }
  }
}
