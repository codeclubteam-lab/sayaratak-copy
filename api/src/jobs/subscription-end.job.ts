import { endExpired } from "~/modules/plans/plans.expiry.service"

import { defineJob } from "./scheduler"

export const subscriptionEndJob = defineJob({
  name: "subscription-end",
  schedule: "0 * * * *",
  run: () => endExpired(),
})
