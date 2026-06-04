import type { PreviewVehicle } from "@/components/website/blocks/VehiclesBlock";
import type { PublicVehicle } from "./vitrinaApi";

export function toPreviewVehicle(v: PublicVehicle): PreviewVehicle {
  return {
    id: v.id,
    make: v.make,
    model: v.model,
    year: v.year,
    price: v.price,
    mileage: v.mileage,
    primary_image_url: v.primary_image_url,
    images: v.images,
    status: v.status ?? null,
  };
}
