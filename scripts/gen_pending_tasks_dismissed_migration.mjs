import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HELPER = `-- Tareas descartadas por el usuario no se recrean al sincronizar alertas.
CREATE OR REPLACE FUNCTION public.pending_task_blocks_auto_create(
  p_entity_type text,
  p_entity_id uuid,
  p_metadata_contains jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pending_tasks pt
    WHERE pt.entity_type = p_entity_type
      AND pt.entity_id = p_entity_id
      AND (
        p_metadata_contains IS NULL
        OR pt.metadata @> p_metadata_contains
      )
      AND (
        pt.completed_at IS NULL
        OR COALESCE(pt.metadata->>'user_dismissed', 'false') = 'true'
      )
  );
$$;

COMMENT ON FUNCTION public.pending_task_blocks_auto_create(text, uuid, jsonb) IS
  'Bloquea crear otra tarea si hay una abierta o descartada (user_dismissed) para la misma entidad/alerta.';
`;

const PATCHES = [
  [
    "supabase/migrations/20260518140000_expand_stale_alert_notifications.sql",
    [
      [
        `    if r.branch_id is not null and not exists (
      select 1 from public.pending_tasks pt
      where pt.entity_type = 'lead'
        and pt.entity_id = r.id
        and pt.completed_at is null
        and pt.metadata->>'stale_reason' = 'no_movement'
    ) then`,
        `    if r.branch_id is not null and not public.pending_task_blocks_auto_create(
      'lead', r.id, jsonb_build_object('stale_reason', 'no_movement')
    ) then`,
      ],
      [
        `    if r.branch_id is not null and not exists (
      select 1 from public.pending_tasks pt
      where pt.entity_type = 'vehicle'
        and pt.entity_id = r.id
        and pt.completed_at is null
        and pt.metadata->>'alert_reason' = 'unpublished'
    ) then`,
        `    if r.branch_id is not null and not public.pending_task_blocks_auto_create(
      'vehicle', r.id, jsonb_build_object('alert_reason', 'unpublished')
    ) then`,
      ],
    ],
    ["sync_stale_leads_to_pending_tasks", "sync_unpublished_vehicles_to_pending_tasks"],
  ],
  [
    "supabase/migrations/20260825120000_consignaciones_pending_status_aware.sql",
    [
      [
        `    if r.branch_id is not null and not exists (
      select 1 from public.pending_tasks pt
      where pt.entity_type = 'consignacion'
        and pt.entity_id = r.id
        and pt.completed_at is null
    ) then`,
        `    if r.branch_id is not null and not public.pending_task_blocks_auto_create(
      'consignacion', r.id, NULL
    ) then`,
      ],
    ],
    ["sync_stale_consignaciones_to_pending_tasks"],
  ],
  [
    "supabase/migrations/20260514120000_tasks_smart_alerts.sql",
    [
      [
        `    if r.branch_id is not null and not exists (
      select 1 from public.pending_tasks pt
      where pt.entity_type = 'lead'
        and pt.entity_id = r.id
        and pt.completed_at is null
        and pt.metadata->>'alert_reason' = 'contacted_no_attempts'
    ) then`,
        `    if r.branch_id is not null and not public.pending_task_blocks_auto_create(
      'lead', r.id, jsonb_build_object('alert_reason', 'contacted_no_attempts')
    ) then`,
      ],
      [
        `    if r.branch_id is not null and not exists (
      select 1 from public.pending_tasks pt
      where pt.entity_type = 'lead'
        and pt.entity_id = r.id
        and pt.completed_at is null
        and pt.metadata->>'alert_reason' = 'searching_car'
    ) then`,
        `    if r.branch_id is not null and not public.pending_task_blocks_auto_create(
      'lead', r.id, jsonb_build_object('alert_reason', 'searching_car')
    ) then`,
      ],
    ],
    [
      "sync_leads_contacted_no_attempts_to_pending_tasks",
      "sync_leads_searching_car_to_pending_tasks",
    ],
  ],
  [
    "supabase/migrations/20260215100000_lead_reminders_and_sync.sql",
    [
      [
        `      and not exists (
        select 1 from pending_tasks pt
        where pt.metadata->>'lead_reminder_id' = lr.id::text and pt.completed_at is null
      )`,
        `      and not public.pending_task_blocks_auto_create(
        'lead', lr.lead_id, jsonb_build_object('lead_reminder_id', lr.id::text)
      )`,
      ],
    ],
    ["sync_lead_reminders_to_pending_tasks"],
  ],
];

function extractFn(content, name) {
  const marker = `create or replace function public.${name}(`;
  const start = content.indexOf(marker);
  if (start < 0) throw new Error(`Function ${name} not found`);
  const slice = content.slice(start);
  const endMatch = slice.match(/[\s\S]*?(?:end;\s*\$\$;|end \$\$;)/i);
  if (!endMatch) throw new Error(`Function end for ${name} not found`);
  return endMatch[0];
}

const parts = [HELPER];
for (const [relPath, replacements, fnNames] of PATCHES) {
  let content = fs.readFileSync(path.join(ROOT, relPath), "utf8").replace(/\r\n/g, "\n");
  for (const [old, neu] of replacements) {
    const needle = old.replace(/\r\n/g, "\n");
    if (!content.includes(needle)) {
      throw new Error(`Pattern missing in ${relPath}`);
    }
    content = content.replace(needle, neu);
  }
  for (const fn of fnNames) {
    parts.push("\n" + extractFn(content, fn) + "\n");
  }
}

const out = path.join(ROOT, "supabase/migrations/20260518170000_pending_tasks_user_dismissed.sql");
fs.writeFileSync(out, parts.join("\n"), "utf8");
console.log("Wrote", out, fs.statSync(out).size, "bytes");
