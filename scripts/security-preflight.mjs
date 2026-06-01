#!/usr/bin/env node
/**
 * Preflight local: verifica que el repo tenga piezas críticas de seguridad.
 * Uso: node scripts/security-preflight.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function ok(name, pass, detail = "") {
  checks.push({ name, pass, detail });
}

const files = [
  "supabase/migrations/20260827120000_risk_mitigation_pack.sql",
  "supabase/migrations/20260601143000_security_production_ready_pack.sql",
  "supabase/migrations/20260601150000_security_hardening_complete_pack.sql",
  "supabase/migrations/20260601150100_lead_ingest_idempotency.sql",
  "supabase/functions/_shared/leadIngestAuth.ts",
  "supabase/functions/_shared/legacyAccess.ts",
  "docs/security/PRODUCTION_READY_CHECKLIST.md",
  ".env.production.example",
];

for (const f of files) {
  ok(f, existsSync(join(root, f)));
}

const mfa = readFileSync(join(root, "src/lib/mfaPolicy.ts"), "utf8");
ok("mfaPolicy env-driven", mfa.includes("VITE_MFA_GATE_ENABLED"));

const ingest = readFileSync(join(root, "api/n8n-lead-ingest.ts"), "utf8");
ok("n8n ingest prod gate", ingest.includes("isProductionEnv"));
ok("n8n idempotency", ingest.includes("lead_ingest_idempotency"));

const leadCreate = readFileSync(
  join(root, "supabase/functions/lead-create/index.ts"),
  "utf8",
);
ok("lead-create per-branch key", leadCreate.includes("resolveLeadAutomationAuth"));

let failed = 0;
for (const c of checks) {
  const icon = c.pass ? "OK" : "FAIL";
  if (!c.pass) failed += 1;
  console.log(`${icon}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll preflight checks passed. Apply migrations + Vercel/Supabase secrets before go-live.");
