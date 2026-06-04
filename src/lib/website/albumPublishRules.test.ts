import { describe, expect, it } from "vitest";

import {
  CONSIGNMENT_REFERENCE_ALBUM,
  countPublishableAlbumPhotos,
  isConsignmentReferenceAsset,
} from "./albumPublishRules";

describe("albumPublishRules", () => {
  it("excluye álbum portada consignación y counts_for_publish false", () => {
    expect(
      isConsignmentReferenceAsset({
        album: CONSIGNMENT_REFERENCE_ALBUM,
        counts_for_publish: true,
      }),
    ).toBe(true);
    expect(
      isConsignmentReferenceAsset({
        album: "Exterior",
        counts_for_publish: false,
      }),
    ).toBe(true);
    expect(
      isConsignmentReferenceAsset({
        album: "Exterior",
        counts_for_publish: true,
      }),
    ).toBe(false);
  });

  it("cuenta solo fotos publicables", () => {
    expect(
      countPublishableAlbumPhotos([
        { album: CONSIGNMENT_REFERENCE_ALBUM, counts_for_publish: false },
        { album: "Exterior", counts_for_publish: true },
        { album: "Exterior", counts_for_publish: true },
      ]),
    ).toBe(2);
  });
});
