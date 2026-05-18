#!/usr/bin/env python3
"""Genera migración: pending_task_blocks_auto_create + sync RPCs parcheados."""
from __future__ import annotations

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]

HELPER = """-- Tareas descartadas por el usuario no se recrean al sincronizar alertas.
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
"""

PATCHES: list[tuple[str, list[tuple[str, str]], list[str]]] = [
    (
        "supabase/migrations/20260518140000_expand_stale_alert_notifications.sql",
        [
            (
                """    if r.branch_id is not null and not exists (
      select 1 from public.pending_tasks pt
      where pt.entity_type = 'lead'
        and pt.entity_id = r.id
        and pt.completed_at is null
        and pt.metadata->>'stale_reason' = 'no_movement'
    ) then""",
                """    if r.branch_id is not null and not public.pending_task_blocks_auto_create(
      'lead', r.id, jsonb_build_object('stale_reason', 'no_movement')
    ) then""",
            ),
            (
                """    if r.branch_id is not null and not exists (
      select 1 from public.pending_tasks pt
      where pt.entity_type = 'vehicle'
        and pt.entity_id = r.id
        and pt.completed_at is null
        and pt.metadata->>'alert_reason' = 'unpublished'
    ) then""",
                """    if r.branch_id is not null and not public.pending_task_blocks_auto_create(
      'vehicle', r.id, jsonb_build_object('alert_reason', 'unpublished')
    ) then""",
            ),
        ],
        ["sync_stale_leads_to_pending_tasks", "sync_unpublished_vehicles_to_pending_tasks"],
    ),
    (
        "supabase/migrations/20260825120000_consignaciones_pending_status_aware.sql",
        [
            (
                """    if r.branch_id is not null and not exists (
      select 1 from public.pending_tasks pt
      where pt.entity_type = 'consignacion'
        and pt.entity_id = r.id
        and pt.completed_at is null
    ) then""",
                """    if r.branch_id is not null and not public.pending_task_blocks_auto_create(
      'consignacion', r.id, NULL
    ) then""",
            ),
        ],
        ["sync_stale_consignaciones_to_pending_tasks"],
    ),
    (
        "supabase/migrations/20260514120000_tasks_smart_alerts.sql",
        [
            (
                """    if r.branch_id is not null and not exists (
      select 1 from public.pending_tasks pt
      where pt.entity_type = 'lead'
        and pt.entity_id = r.id
        and pt.completed_at is null
        and pt.metadata->>'alert_reason' = 'contacted_no_attempts'
    ) then""",
                """    if r.branch_id is not null and not public.pending_task_blocks_auto_create(
      'lead', r.id, jsonb_build_object('alert_reason', 'contacted_no_attempts')
    ) then""",
            ),
            (
                """    if r.branch_id is not null and not exists (
      select 1 from public.pending_tasks pt
      where pt.entity_type = 'lead'
        and pt.entity_id = r.id
        and pt.completed_at is null
        and pt.metadata->>'alert_reason' = 'searching_car'
    ) then""",
                """    if r.branch_id is not null and not public.pending_task_blocks_auto_create(
      'lead', r.id, jsonb_build_object('alert_reason', 'searching_car')
    ) then""",
            ),
        ],
        [
            "sync_leads_contacted_no_attempts_to_pending_tasks",
            "sync_leads_searching_car_to_pending_tasks",
        ],
    ),
    (
        "supabase/migrations/20260215100000_lead_reminders_and_sync.sql",
        [
            (
                """      and not exists (
        select 1 from pending_tasks pt
        where pt.metadata->>'lead_reminder_id' = lr.id::text and pt.completed_at is null
      )""",
                """      and not public.pending_task_blocks_auto_create(
        'lead', lr.lead_id, jsonb_build_object('lead_reminder_id', lr.id::text)
      )""",
            ),
        ],
        ["sync_lead_reminders_to_pending_tasks"],
    ),
]


def extract_fn(content: str, name: str) -> str:
    pattern = rf"(?ms)(create or replace function public\.{re.escape(name)}\(.*?\n\$\$;)"
    match = re.search(pattern, content)
    if not match:
        raise SystemExit(f"Function {name} not found")
    return match.group(1)


def main() -> None:
    parts = [HELPER]
    for rel_path, replacements, fn_names in PATCHES:
        path = ROOT / rel_path
        content = path.read_text(encoding="utf-8")
        for old, new in replacements:
            if old not in content:
                raise SystemExit(f"Pattern missing in {rel_path}")
            content = content.replace(old, new)
        for fn in fn_names:
            parts.append("\n" + extract_fn(content, fn) + "\n")

    out = ROOT / "supabase/migrations/20260518170000_pending_tasks_user_dismissed.sql"
    out.write_text("\n".join(parts), encoding="utf-8")
    print(f"Wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
