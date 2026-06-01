import { NextResponse } from "next/server";

import { getRequestHost } from "@vitrina/lib/host";
import { submitLead } from "@vitrina/lib/vitrinaApi";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const host =
      typeof body.host === "string" && body.host.trim()
        ? body.host.trim().toLowerCase()
        : getRequestHost();
    const result = await submitLead(host, body);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 },
    );
  }
}
