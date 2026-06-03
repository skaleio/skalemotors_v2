#!/usr/bin/env node
/**
 * Prueba E2E ingesta landing → lead + cita.
 * Uso: LANDING_BOOKING_API_KEY=<clave> node scripts/test-landing-booking.mjs
 * Opcional: LANDING_BOOKING_URL, TEST_DATE (YYYY-MM-DD), TEST_TIME (HH:mm)
 */
const url =
  process.env.LANDING_BOOKING_URL?.trim() ||
  "https://skalemotors-v2.vercel.app/api/landing-booking";
const apiKey = process.env.LANDING_BOOKING_API_KEY?.trim();
const date = process.env.TEST_DATE?.trim() || "2026-06-04";
const time = process.env.TEST_TIME?.trim() || "11:00";

if (!apiKey) {
  console.error("Falta LANDING_BOOKING_API_KEY (clave mintada en Ajustes → API ingesta)");
  process.exit(1);
}

const body = {
  full_name: "Test Calendario",
  phone: "+56 912345678",
  email: "test-calendario@example.com",
  date,
  time,
  notes: `Prueba script ${new Date().toISOString()}`,
  source: "script-test",
};

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
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
console.log("Body:", JSON.stringify(json, null, 2));

if (!res.ok || !json?.appointment?.id) {
  process.exit(1);
}

console.log("\nOK — Revisá en Skale Motors → Citas el", date, "buscando:", json.appointment.id);
