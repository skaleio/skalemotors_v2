import { describe, expect, it } from "vitest";

import { validateVehicleWebPublish } from "./vehicleWebPublish";
import { MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH } from "@/lib/website/albumQueues";

describe("validateVehicleWebPublish", () => {
  it("rechaza sin suficientes fotos de álbum", () => {
    expect(
      validateVehicleWebPublish({
        status: "disponible",
        publishablePhotoCount: 0,
        price: 1,
      }),
    ).toMatch(/foto/);
    expect(
      validateVehicleWebPublish({
        status: "disponible",
        publishablePhotoCount: MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH - 1,
        price: 1,
      }),
    ).toMatch(/15/);
  });
  it("rechaza sin precio", () => {
    expect(
      validateVehicleWebPublish({
        status: "disponible",
        publishablePhotoCount: MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH,
        price: 0,
      }),
    ).toMatch(/precio/);
  });
  it("rechaza vendido", () => {
    expect(
      validateVehicleWebPublish({
        status: "vendido",
        publishablePhotoCount: MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH,
        price: 1,
      }),
    ).toMatch(/disponible o reservado/);
  });
  it("acepta reservado con 15+ fotos y precio", () => {
    expect(
      validateVehicleWebPublish({
        status: "reservado",
        publishablePhotoCount: MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH,
        price: 5_000_000,
      }),
    ).toBeNull();
  });
});
