import { notifyExpired } from "~/modules/listings/listings.expiry.service"

import { defineJob } from "./scheduler"

export const listingExpiryJob = defineJob({
  name: "listing-expiry",
  schedule: "*/15 * * * *",
  run: () => notifyExpired(),
})
