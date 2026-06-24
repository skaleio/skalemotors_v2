import { describe, expect, it } from "vitest";
import {
  buildLeadNoteAttachmentPath,
  MAX_ATTACHMENTS_PER_NOTE,
  parseAttachments,
  selectValidAttachments,
} from "./leadNoteAttachments";

function makeFile(name: string, type: string, size: number): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("buildLeadNoteAttachmentPath", () => {
  it("arma el path con tenant/lead/note y conserva la extensión", () => {
    const path = buildLeadNoteAttachmentPath({
      tenantId: "t1",
      leadId: "l1",
      noteId: "n1",
      fileName: "foto.PNG",
      mime: "image/png",
      now: 1000,
      rand: "abcd",
    });
    expect(path).toBe("t1/l1/n1/1000-abcd.png");
  });

  it("infiere extensión desde el mime cuando el nombre no la trae", () => {
    const path = buildLeadNoteAttachmentPath({
      tenantId: "t1",
      leadId: "l1",
      noteId: "n1",
      fileName: "captura",
      mime: "image/webp",
      now: 1,
      rand: "z",
    });
    expect(path.endsWith(".webp")).toBe(true);
  });
});

describe("selectValidAttachments", () => {
  it("acepta imágenes válidas y rechaza no-imágenes", () => {
    const { accepted, rejected } = selectValidAttachments({
      files: [
        makeFile("a.jpg", "image/jpeg", 1000),
        makeFile("doc.pdf", "application/pdf", 1000),
      ],
      existingCount: 0,
    });
    expect(accepted.map((f) => f.name)).toEqual(["a.jpg"]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].name).toBe("doc.pdf");
  });

  it("respeta el cupo restante por nota", () => {
    const files = Array.from({ length: MAX_ATTACHMENTS_PER_NOTE }, (_, i) =>
      makeFile(`f${i}.jpg`, "image/jpeg", 100),
    );
    const { accepted, rejected } = selectValidAttachments({ files, existingCount: 4 });
    expect(accepted).toHaveLength(MAX_ATTACHMENTS_PER_NOTE - 4);
    expect(rejected).toHaveLength(4);
  });

  it("rechaza archivos demasiado grandes", () => {
    const { accepted, rejected } = selectValidAttachments({
      files: [makeFile("big.jpg", "image/jpeg", 30 * 1024 * 1024)],
      existingCount: 0,
    });
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toContain("tamaño");
  });
});

describe("parseAttachments", () => {
  it("filtra entradas inválidas y normaliza campos faltantes", () => {
    const parsed = parseAttachments([
      { path: "t/l/n/1.jpg", name: "x.jpg", size: 10, mime: "image/jpeg" },
      { name: "sin-path" },
      null,
      "basura",
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].path).toBe("t/l/n/1.jpg");
  });

  it("devuelve arreglo vacío si no es un array", () => {
    expect(parseAttachments(null)).toEqual([]);
    expect(parseAttachments({})).toEqual([]);
  });
});
