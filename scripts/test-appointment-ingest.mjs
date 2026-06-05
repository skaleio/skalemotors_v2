#!/usr/bin/env node
/**
 * Prueba POST /api/appointment-ingest (misma clave que ingesta de leads).
 *
 * Uso:
 *   APPOINTMENT_INGEST_API_KEY=<clave> \
 *   APPOINTMENT_INGEST_ASSIGNED_TO=1bad02e7-7888-4cbc-9d79-e4d583401ed0 \
 *   node scripts/test-appointment-ingest.mjs
 */
const url =
  process.env.APPOINTMENT_INGEST_URL?.trim() ||
  "https://skalemotors-v2.vercel.app/api/appointment-ingest";
const apiKey = process.env.APPOINTMENT_INGEST_API_KEY?.trim();
const assignedTo =
  process.env.APPOINTMENT_INGEST_ASSIGNED_TO?.trim() ||
  "f42dab10-6dcc-4f99-b169-e679eea0638d";
const date = process.env.TEST_DATE?.trim() || "2026-06-04";
const time = process.env.TEST_TIME?.trim() || "10:00";

if (!apiKey) {
  console.error("Falta APPOINTMENT_INGEST_API_KEY (clave mintada en Ajustes → API ingesta)");
  process.exit(1);
}

const body = {
  full_name: "Test Webhook Cita",
  phone: "+56 912345679",
  email: "test-cita@example.com",
  date,
  time,
  type: "reunion",
  title: `Visita agendada · Test Webhook Cita`,
  notes: `Prueba appointment-ingest ${new Date().toISOString()}`,
  source: "landing-webhook",
  assigned_to: assignedTo,
};

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "Idempotency-Key": `test-${date}-${time}-${Date.now()}`,
  },
  body: JSON.stringify(body),
});

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = { raw: text };
}

console.log("URL:", url);
console.log("Status:", res.status);
console.log(JSON.stringify(json, null, 2));

if (!res.ok || !json?.appointment?.id) {
  process.exit(1);
}

console.log("\nOK — En Skale Motors → Citas (", date, ") busca id:", json.appointment.id);
