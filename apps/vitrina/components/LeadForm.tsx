"use client";

import { useState } from "react";

interface LeadFormProps {
  host: string;
  vehicleId?: string;
  vehicleLabel?: string;
}

export function LeadForm({ host, vehicleId, vehicleLabel }: LeadFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    const fd = new FormData(e.currentTarget);
    const payload = {
      full_name: fd.get("full_name"),
      phone: fd.get("phone"),
      email: fd.get("email"),
      message: fd.get("message"),
      vehicle_id: vehicleId ?? null,
      company: fd.get("company"),
      host,
    };
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al enviar");
      setStatus("ok");
      e.currentTarget.reset();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Error al enviar");
    }
  }

  if (status === "ok") {
    return (
      <p className="rounded-md border p-4 text-sm" style={{ borderColor: "var(--sm-border)", color: "var(--sm-fg)" }}>
        ¡Gracias! Te contactaremos pronto.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-3">
      {vehicleLabel ? (
        <p className="text-sm" style={{ color: "var(--sm-muted)" }}>
          Consulta por: <strong>{vehicleLabel}</strong>
        </p>
      ) : null}
      <input type="text" name="company" className="hidden" tabIndex={-1} autoComplete="off" />
      <input
        name="full_name"
        required
        placeholder="Nombre"
        className="w-full rounded-md border px-3 py-2 text-sm"
        style={{ borderColor: "var(--sm-border)", background: "var(--sm-surface)", color: "var(--sm-fg)" }}
      />
      <input
        name="phone"
        required
        placeholder="Teléfono / WhatsApp"
        className="w-full rounded-md border px-3 py-2 text-sm"
        style={{ borderColor: "var(--sm-border)", background: "var(--sm-surface)", color: "var(--sm-fg)" }}
      />
      <input
        name="email"
        type="email"
        placeholder="Email (opcional)"
        className="w-full rounded-md border px-3 py-2 text-sm"
        style={{ borderColor: "var(--sm-border)", background: "var(--sm-surface)", color: "var(--sm-fg)" }}
      />
      <textarea
        name="message"
        rows={3}
        placeholder="Mensaje"
        className="w-full rounded-md border px-3 py-2 text-sm"
        style={{ borderColor: "var(--sm-border)", background: "var(--sm-surface)", color: "var(--sm-fg)" }}
      />
      {status === "error" ? <p className="text-sm text-red-600">{errorMsg}</p> : null}
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
        style={{ backgroundColor: "var(--sm-primary)", color: "var(--sm-primary-fg)" }}
      >
        {status === "loading" ? "Enviando…" : "Enviar consulta"}
      </button>
    </form>
  );
}
