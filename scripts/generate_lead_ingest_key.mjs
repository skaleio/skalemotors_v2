#!/usr/bin/env node
/**
 * Genera una clave aleatoria para lead ingest y un INSERT listo para Supabase (secret_hash = SHA-256).
 *
 * Uso:
 *   node scripts/generate_lead_ingest_key.mjs <tenant_uuid> <branch_uuid> "Etiqueta opcional"
 *
 * La clave en texto plano se muestra una sola vez; cópiala al n8n (header x-api-key).
 * Ejecuta el SQL en el SQL Editor de Supabase (o psql).
 */
import { createHash, randomBytes } from "node:crypto";

const [tenantId, branchId, ...labelParts] = process.argv.slice(2);
const label = labelParts.join(" ").trim() || "n8n";

if (!tenantId || !branchId) {
  console.error(
    "Uso: node scripts/generate_lead_ingest_key.mjs <tenant_id> <branch_id> [etiqueta]"
  );
  process.exit(1);
}

const plainKey = randomBytes(32).toString("base64url");
const secretHash = createHash("sha256").update(plainKey, "utf8").digest("hex");

const esc = (s) => s.replace(/'/g, "''");

console.log("\n--- Clave (mostrar solo al cliente / pegar en n8n; no commitear) ---\n");
console.log(plainKey);
console.log("\n--- SQL (ejecutar en Supabase) ---\n");
console.log(`INSERT INTO public.lead_ingest_keys (tenant_id, branch_id, label, secret_hash)
VALUES (
  '${esc(tenantId)}'::uuid,
  '${esc(branchId)}'::uuid,
  '${esc(label)}',
  '${esc(secretHash)}'
);`);
console.log("");
