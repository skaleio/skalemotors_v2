import { describe, expect, it } from "vitest";

import {
  filterAlbumVehicles,
  matchesAlbumQueueTab,
  MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH,
  vehicleHasMinimumAlbumPhotos,
  type AlbumVehicleRow,
} from "./albumQueues";

const base = (over: Partial<AlbumVehicleRow>): AlbumVehicleRow => ({
  id: "1",
  make: "Toyota",
  model: "Corolla",
  year: 2020,
  patente: "ABCD12",
  price: 10_000_000,
  images: [],
  publishable_photo_count: 0,
  publicado_web: false,
  status: "disponible",
  ...over,
});

describe("vehicleHasMinimumAlbumPhotos", () => {
  it(`false con menos de ${MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH}`, () => {
    expect(vehicleHasMinimumAlbumPhotos(14)).toBe(false);
    expect(vehicleHasMinimumAlbumPhotos(0)).toBe(false);
  });
  it(`true con ${MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH} o más`, () => {
    expect(vehicleHasMinimumAlbumPhotos(15)).toBe(true);
    expect(vehicleHasMinimumAlbumPhotos(20)).toBe(true);
  });
});

describe("matchesAlbumQueueTab", () => {
  it("sin_fotos cuando faltan fotos de álbum publicables", () => {
    expect(matchesAlbumQueueTab(base({ publishable_photo_count: 0 }), "sin_fotos")).toBe(true);
    expect(matchesAlbumQueueTab(base({ publishable_photo_count: 14 }), "sin_fotos")).toBe(true);
    expect(matchesAlbumQueueTab(base({ publishable_photo_count: 15 }), "sin_fotos")).toBe(false);
  });
  it("listos: 15+ fotos publicables, no publicado, operativo", () => {
    const row = base({ publishable_photo_count: 15, publicado_web: false, status: "reservado" });
    expect(matchesAlbumQueueTab(row, "listos")).toBe(true);
    expect(matchesAlbumQueueTab(base({ publicado_web: true, publishable_photo_count: 20 }), "listos")).toBe(
      false,
    );
    expect(matchesAlbumQueueTab(base({ publishable_photo_count: 15, status: "vendido" }), "listos")).toBe(
      false,
    );
  });
});

describe("filterAlbumVehicles", () => {
  it("filtra por búsqueda y pestaña", () => {
    const rows = [
      base({ id: "1", make: "Toyota", publishable_photo_count: 0 }),
      base({ id: "2", make: "Honda", publishable_photo_count: 15, publicado_web: false }),
    ];
    const out = filterAlbumVehicles(rows, "sin_fotos", "toy");
    expect(out.map((r) => r.id)).toEqual(["1"]);
  });
});
