import { describe, expect, it } from "vitest";

import {
  albumCoverUrl,
  albumMatchesPhotoViewTab,
  countAssetsByPhotoViewTab,
  flattenVehicleImageUrls,
  groupAssetsByAlbum,
} from "./albumDisplay";
import type { VehiclePhotoAsset } from "@/lib/services/vehiclePhotos";

function asset(partial: Partial<VehiclePhotoAsset> & Pick<VehiclePhotoAsset, "url" | "album">): VehiclePhotoAsset {
  return {
    id: partial.id ?? "a",
    tenant_id: "t",
    vehicle_id: "v",
    album: partial.album,
    url: partial.url,
    sort_order: partial.sort_order ?? 0,
    is_cover: partial.is_cover ?? false,
    counts_for_publish: partial.counts_for_publish ?? true,
    created_by: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("albumDisplay", () => {
  it("flattenVehicleImageUrls pone portada primero sin duplicar", () => {
    const assets = [
      asset({ id: "1", album: "Ext", url: "https://x/a.jpg", is_cover: false, sort_order: 2 }),
      asset({ id: "2", album: "Ext", url: "https://x/b.jpg", is_cover: true, sort_order: 1 }),
    ];
    expect(flattenVehicleImageUrls(assets)).toEqual(["https://x/b.jpg", "https://x/a.jpg"]);
  });

  it("albumCoverUrl prefiere is_cover del álbum", () => {
    const list = [
      asset({ album: "Int", url: "https://x/1.jpg", sort_order: 1 }),
      asset({ album: "Int", url: "https://x/2.jpg", is_cover: true, sort_order: 2 }),
    ];
    expect(albumCoverUrl(list)).toBe("https://x/2.jpg");
  });

  it("albumMatchesPhotoViewTab agrupa carrocería e interior", () => {
    expect(albumMatchesPhotoViewTab("General", "carroceria")).toBe(true);
    expect(albumMatchesPhotoViewTab("Exterior", "carroceria")).toBe(true);
    expect(albumMatchesPhotoViewTab("Interior", "interior")).toBe(true);
    expect(albumMatchesPhotoViewTab("Interior", "carroceria")).toBe(false);
    expect(albumMatchesPhotoViewTab("Portada consignación", "todas")).toBe(true);
  });

  it("countAssetsByPhotoViewTab filtra por pestaña", () => {
    const assets = [
      asset({ album: "General", url: "u1" }),
      asset({ album: "Interior", url: "u2" }),
      asset({ album: "Interior", url: "u3" }),
    ];
    expect(countAssetsByPhotoViewTab(assets, "carroceria")).toBe(1);
    expect(countAssetsByPhotoViewTab(assets, "interior")).toBe(2);
    expect(countAssetsByPhotoViewTab(assets, "todas")).toBe(3);
  });

  it("groupAssetsByAlbum ordena portada primero dentro del álbum", () => {
    const map = groupAssetsByAlbum([
      asset({ id: "1", album: "B", url: "u1", sort_order: 2 }),
      asset({ id: "2", album: "A", url: "u2", is_cover: true, sort_order: 1 }),
      asset({ id: "3", album: "A", url: "u3", sort_order: 2 }),
    ]);
    expect([...map.keys()]).toEqual(["A", "B"]);
    expect(map.get("A")!.map((a) => a.url)).toEqual(["u2", "u3"]);
  });
});
