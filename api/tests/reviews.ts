import { pageOf } from "@sayaratak/shared/schemas/fields"
import { reviewSchema } from "@sayaratak/shared/schemas/review"

import { call, expectSchema, req, type SignedIn } from "./helpers"

// Seed: w-1 (owner u-workshop) has r-19, r-70, r-93 shown and r-114, r-115 hidden, none answered;
// d-1 (u-dealer) has r-4, answered; m-1 (u-mechanic) has r-36, not answered.
export const pageSchema = pageOf(reviewSchema)
export const list = (query: string, as?: SignedIn) =>
  req(`/reviews?${query}`, as && { headers: { cookie: as.cookie } })
export const post = (as: SignedIn, body: object) =>
  call(as, "/reviews", { method: "POST", body })
export const idsOf = async (res: Response) =>
  (await expectSchema(res, pageSchema)).items.map((r) => r.id).sort()
export const review = { targetType: "dealership", targetId: "d-1", rating: 4 }
