import { endExpired } from "~/modules/promotions/promotions.service"

import { defineJob } from "./scheduler"

export const promotionEndJob = defineJob({
  name: "promotion-end",
  schedule: "*/5 * * * *",
  run: () => endExpired(),
})
