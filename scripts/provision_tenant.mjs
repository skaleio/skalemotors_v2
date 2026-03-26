import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para provisioning.");
}

const [slug, name, jefeEmail, jefeNombre] = process.argv.slice(2);

if (!slug || !name || !jefeEmail || !jefeNombre) {
  console.error("Uso: node scripts/provision_tenant.mjs <slug> <name> <jefeEmail> <jefeNombre>");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const { data, error } = await supabase.rpc("provision_tenant", {
  p_slug: slug,
  p_name: name,
  p_jefe_jefe_email: jefeEmail,
  p_jefe_jefe_full_name: jefeNombre,
});

if (error) {
  throw error;
}

console.log("Tenant provisionado:", data);
