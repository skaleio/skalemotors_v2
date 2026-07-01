#!/usr/bin/env node
/**
 * MCP server de Skale Motors: cargar leads y agendar citas hablándole a Claude.
 *
 * No reimplementa nada: cada tool hace POST al endpoint ya en producción
 * (api/n8n-lead-ingest), que valida, normaliza el teléfono chileno, resuelve
 * el tenant del lado servidor y maneja idempotencia + update-or-insert.
 *
 * Config por variables de entorno (ver .env.example):
 *   SKALE_INGEST_URL      URL del endpoint, p.ej. https://app.skalemotors.com/api/n8n-lead-ingest
 *   SKALE_INGEST_API_KEY  Clave de lead_ingest_keys (scopeada a una sucursal)
 *   SKALE_BRANCH_ID       (opcional) UUID de sucursal; si se omite, lo resuelve la key
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";

const INGEST_URL = process.env.SKALE_INGEST_URL?.trim();
const API_KEY = process.env.SKALE_INGEST_API_KEY?.trim();
const BRANCH_ID = process.env.SKALE_BRANCH_ID?.trim() || undefined;

if (!INGEST_URL || !API_KEY) {
  console.error(
    "[skale-mcp] Faltan SKALE_INGEST_URL y/o SKALE_INGEST_API_KEY en el entorno."
  );
  process.exit(1);
}

/** POST al endpoint de ingesta. Devuelve { ok, status, data }. */
async function postIngest(payload) {
  const body = { ...payload };
  if (BRANCH_ID) body.branch_id = BRANCH_ID;

  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(body),
  });

  let json;
  try {
    json = await res.json();
  } catch {
    json = { ok: false, error: `Respuesta no-JSON (HTTP ${res.status})` };
  }
  return { ok: res.ok && json?.ok !== false, status: res.status, data: json };
}

function textResult(text, isError = false) {
  return { content: [{ type: "text", text }], isError };
}

function describeLead(data) {
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

const server = new McpServer({
  name: "skalemotors-lead-ingest",
  version: "0.1.0",
});

const leadShape = {
  full_name: z.string().describe("Nombre completo del lead. Requerido."),
  phone: z
    .string()
    .describe(
      "Teléfono. Acepta formato libre chileno; el servidor lo normaliza a +56. Requerido."
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

server.tool(
  "crear_lead",
  "Crea (o actualiza si el teléfono ya existe) un lead en Skale Motors con sus datos. " +
    "Usar cuando llega un contacto nuevo y hay que cargarlo en el CRM.",
  leadShape,
  async (args) => {
    try {
      const result = await postIngest(args);
      if (!result.ok) {
        return textResult(
          `No se pudo crear el lead (HTTP ${result.status}): ${
            result.data?.error ?? "error desconocido"
          }`,
          true
        );
      }
      return textResult(describeLead(result.data));
    } catch (err) {
      return textResult(`Error de red al crear el lead: ${err.message}`, true);
    }
  }
);

server.tool(
  "agendar_cita",
  "Crea o actualiza el lead y agenda una cita para él en el mismo paso. " +
    "Usar cuando el contacto ya quiere venir a la sucursal en una fecha/hora concreta.",
  {
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
  },
  async (args) => {
    try {
      const result = await postIngest(args);
      if (!result.ok) {
        return textResult(
          `No se pudo agendar la cita (HTTP ${result.status}): ${
            result.data?.error ?? "error desconocido"
          }`,
          true
        );
      }
      return textResult(describeLead(result.data));
    } catch (err) {
      return textResult(`Error de red al agendar la cita: ${err.message}`, true);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[skale-mcp] lead-ingest server listo (stdio).");
