#!/usr/bin/env node
/**
 * Audita el estado de RLS en tablas críticas vía la RPC `audit_rls_status`.
 *
 * Uso:
 *   npm run check:rls                  # tablas críticas por defecto
 *   node scripts/check-rls.mjs leads vehicles sales  # tablas específicas
 *
 * Requiere en .env (o env):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (NO usar anon key; la RPC requiere service_role)
 *
 * Exit code:
 *   0 si todas las tablas tienen RLS habilitado + al menos 1 policy + filtro de tenant
 *   1 si alguna tabla está expuesta sin policies o sin filtro tenant
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnvFile(path.resolve(__dirname, "..", ".env"));
loadDotEnvFile(path.resolve(__dirname, "..", ".env.local"));

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env. " +
      "El service_role key es necesario porque la RPC `audit_rls_status` está revocada para anon/authenticated."
  );
  process.exit(2);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const tablesArg = process.argv.slice(2).filter(Boolean);
const params = tablesArg.length > 0 ? { p_tables: tablesArg } : {};

const { data, error } = await supabase.rpc("audit_rls_status", params);

if (error) {
  console.error("Error llamando audit_rls_status:", error.message);
  console.error(
    "Probable causa: la migración 20260823120000_audit_rls_status_rpc.sql no se aplicó todavía. Aplicala con `supabase db push` o vía MCP."
  );
  process.exit(2);
}

if (!Array.isArray(data) || data.length === 0) {
  console.error("La RPC devolvió un payload vacío. Revisar la definición.");
  process.exit(2);
}

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function pad(s, n) {
  const str = String(s);
  return str.length >= n ? str : str + " ".repeat(n - str.length);
}

let problems = 0;
const rows = [];

for (const row of data) {
  const rlsOk = row.rls_enabled === true;
  const hasPolicy = row.policy_count > 0;
  const hasTenant = row.has_tenant_filter === true;
  const exists = rlsOk || hasPolicy;

  let status;
  if (!exists) {
    status = `${YELLOW}MISSING${RESET}`;
  } else if (!rlsOk) {
    status = `${RED}NO RLS${RESET}`;
    problems++;
  } else if (!hasPolicy) {
    status = `${RED}0 POLICIES${RESET}`;
    problems++;
  } else if (!hasTenant) {
    status = `${YELLOW}NO TENANT FILTER${RESET}`;
    problems++;
  } else {
    status = `${GREEN}OK${RESET}`;
  }

  rows.push({
    table: row.table,
    rls: rlsOk ? "OK" : "X",
    policies: row.policy_count,
    tenant: hasTenant ? "OK" : "X",
    branch: row.has_branch_filter ? "OK" : "-",
    status,
  });
}

console.log("");
console.log(
  pad("TABLA", 36) +
    pad("RLS", 6) +
    pad("POLICIES", 12) +
    pad("TENANT", 10) +
    pad("BRANCH", 10) +
    "STATUS"
);
console.log(DIM + "-".repeat(90) + RESET);

for (const r of rows) {
  console.log(
    pad(r.table, 36) +
      pad(r.rls, 6) +
      pad(r.policies, 12) +
      pad(r.tenant, 10) +
      pad(r.branch, 10) +
      r.status
  );
}

console.log("");
console.log(
  `Total: ${rows.length} tablas - Problemas: ${problems > 0 ? RED + problems + RESET : GREEN + "0" + RESET}`
);
console.log("");

process.exit(problems > 0 ? 1 : 0);
