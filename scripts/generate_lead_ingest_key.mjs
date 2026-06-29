#!/usr/bin/env node
/**
 * Genera una clave aleatoria para lead ingest y un INSERT listo para Supabase (secret_hash = SHA-256).
 *
 * Uso:
 *   Key por sucursal:  node scripts/generate_lead_ingest_key.mjs <tenant_uuid> <branch_uuid> "Etiqueta"
 *   Key por tenant:    node scripts/generate_lead_ingest_key.mjs <tenant_uuid> --tenant "Etiqueta"
 *
 * Una key por tenant (branch_id NULL) sirve para todas las sucursales del concesionario;
 * el request indica la sucursal y el endpoint valida que pertenezca al tenant.
 *
 * La clave en texto plano se muestra una sola vez; cópiala al cliente / config (header x-api-key).
 * Ejecuta el SQL en el SQL Editor de Supabase (o psql).
 */
import { createHash, randomBytes } from "node:crypto";

const [tenantId, scopeArg, ...labelParts] = process.argv.slice(2);
const label = labelParts.join(" ").trim() || "n8n";
const tenantScoped = scopeArg === "--tenant";
const branchId = tenantScoped ? null : scopeArg;

if (!tenantId || !scopeArg) {
  console.error(
    "Uso:\n" +
      "  Key por sucursal: node scripts/generate_lead_ingest_key.mjs <tenant_id> <branch_id> [etiqueta]\n" +
      "  Key por tenant:   node scripts/generate_lead_ingest_key.mjs <tenant_id> --tenant [etiqueta]"
  );
  process.exit(1);
}

const plainKey = randomBytes(32).toString("base64url");
const secretHash = createHash("sha256").update(plainKey, "utf8").digest("hex");

const esc = (s) => s.replace(/'/g, "''");
const branchValue = branchId ? `'${esc(branchId)}'::uuid` : "NULL";

console.log("\n--- Clave (mostrar solo al cliente / pegar en config; no commitear) ---\n");
console.log(plainKey);
console.log(
  `\n--- Alcance: ${tenantScoped ? "TENANT (todas las sucursales)" : "SUCURSAL"} ---`
);
console.log("\n--- SQL (ejecutar en Supabase) ---\n");
console.log(`INSERT INTO public.lead_ingest_keys (tenant_id, branch_id, label, secret_hash)
VALUES (
  '${esc(tenantId)}'::uuid,
  ${branchValue},
  '${esc(label)}',
  '${esc(secretHash)}'
);`);
console.log("");
