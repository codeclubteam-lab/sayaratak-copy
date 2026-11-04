import type { Media } from "@sayaratak/shared/schemas/listing"
import { mediaSchema } from "@sayaratak/shared/schemas/listing"

import { toListingInput } from "../../web/src/features/listings/wizard/to-listing-input"
import { wizardDefaults } from "../../web/src/features/listings/wizard/wizard-defaults"
import { fileOf, postUpload } from "./files"
import { req, type SignedIn } from "./helpers"

/** Uploads `count` photos as the account and answers their `Media`. */
export async function uploadPhotos(as: SignedIn, count = 3) {
  const media: Media[] = []
  for (let i = 0; i < count; i++) {
    const res = await postUpload(as, { file: fileOf("jpeg") })
    media.push(mediaSchema.parse(await res.json()))
  }
  return media
}

/**
 * What the post wizard sends for a car, built by the web's own mapper (the
 * same values as web/tests/handlers.test.ts), with the photos given.
 */
export function carBody(media: Media[], values: Record<string, unknown> = {}) {
  return toListingInput({
    ...wizardDefaults,
    kind: "vehicle",
    vehicleType: "car",
    intent: "sale",
    title: "Toyota Corolla 2018",
    description: "Clean car, one owner, full service history.",
    price: 12_000_000,
    makeId: "toyota",
    modelId: "toyota-corolla",
    year: 2018,
    fuel: "petrol",
    transmission: "automatic",
    mileageKm: 90_000,
    media,
    cityId: "khartoum",
    districtId: "khartoum-riyadh",
    phone: "+249912345678",
    methods: ["call", "chat"],
    ...values,
  })
}

/** A JSON request as a signed-in browser. */
export function send(
  as: SignedIn,
  path: string,
  init: { method: string; body?: unknown }
) {
  return req(path, {
    method: init.method,
    headers: {
      cookie: as.cookie,
      origin: as.origin,
      "content-type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}
