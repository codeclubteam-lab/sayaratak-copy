import type { Media, VehicleType } from "@sayaratak/shared/schemas/listing"
import { pad } from "./util"

export type PhotoType = VehicleType | "part"
// 24 vehicle photos grouped by type, 6 business photos. Missing files fall back to the placeholder tile in MediaImage.
const ranges: Record<PhotoType, readonly [number, number]> = {
  car: [1, 12],
  truck: [13, 16],
  motorcycle: [17, 20],
  tuk_tuk: [21, 24],
  rickshaw: [21, 24],
  part: [1, 24],
}
const colors = [
  "#c9d3cf",
  "#b8c4c0",
  "#d6d9d2",
  "#aebcb5",
  "#cfd6d1",
  "#bfc8c2",
]

export function pickMockPhoto(type: PhotoType, seed: number): Media {
  const [lo, hi] = ranges[type]
  const n = lo + (Math.abs(seed) % (hi - lo + 1))
  return {
    id: `ph-${n}-${Math.abs(seed)}`,
    type: "image",
    url: `/mock/vehicle-${pad(n)}-{w}.webp`,
    width: 1280,
    height: 853,
    placeholderColor: colors[n % colors.length] ?? "#c9d3cf",
    posterUrl: null,
  }
}

export const businessPhoto = (seed: number, width = 640) =>
  `/mock/business-${(Math.abs(seed) % 6) + 1}-${width}.webp`
export const businessMedia = (seed: number): Media => ({
  id: `bp-${Math.abs(seed)}`,
  type: "image",
  url: businessPhoto(seed, 0).replace("-0.", "-{w}."),
  width: 1280,
  height: 853,
  placeholderColor: colors[Math.abs(seed) % colors.length] ?? "#c9d3cf",
  posterUrl: null,
})
