import type { VehicleType } from "../schemas/listing"

// URL segment of a landing preset (`/vehicles/cars/sale`) to the stored vehicle type.
export const TYPE_SLUGS = {
  cars: "car",
  trucks: "truck",
  motorcycles: "motorcycle",
  "tuk-tuks": "tuk_tuk",
  rickshaws: "rickshaw",
} as const satisfies Record<string, VehicleType>
