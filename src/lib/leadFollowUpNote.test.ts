import { describe, expect, it } from "vitest";
import { validateChannelNote } from "./leadFollowUpNote";

const NEXT = "2026-07-01T10:00:00.000Z";

describe("validateChannelNote", () => {
  it("acepta nota con contexto real y próxima acción", () => {
    const r = validateChannelNote({
      body: "Le ofrecí el Sail 2019, quedó de confirmar con la señora el viernes.",
      nextActionAt: NEXT,
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("rechaza notas genéricas aunque tengan próxima acción", () => {
    for (const body of ["ok", "listo", "hecho", "llamé", "llame", "no contesta", "wsp", "."]) {
      const r = validateChannelNote({ body, nextActionAt: NEXT });
      expect(r.ok, `debió rechazar "${body}"`).toBe(false);
    }
  });

  it("rechaza notas demasiado cortas (menos de 15 caracteres con sentido)", () => {
    const r = validateChannelNote({ body: "llamé 2 veces", nextActionAt: NEXT });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/contexto real/i);
  });

  it("rechaza si falta la próxima acción con fecha", () => {
    const r = validateChannelNote({
      body: "Conversamos del financiamiento, pidió simulación a 48 cuotas.",
      nextActionAt: "",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /próxima acción/i.test(e))).toBe(true);
  });

  it("acumula ambos errores cuando falta todo", () => {
    const r = validateChannelNote({ body: "ok", nextActionAt: null });
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(2);
  });

  it("ignora espacios al medir longitud y limpia acentos", () => {
    const r = validateChannelNote({ body: "   ok   ", nextActionAt: NEXT });
    expect(r.ok).toBe(false);
  });
});
