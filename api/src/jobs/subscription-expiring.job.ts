import { notifyExpiring } from "~/modules/plans/plans.expiry.service"

import { defineJob } from "./scheduler"

export const subscriptionExpiringJob = defineJob({
  name: "subscription-expiring",
  schedule: "0 9 * * *",
  run: () => notifyExpiring(),
})
