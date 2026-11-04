import { liftExpiredBans } from "~/modules/auth/auth.service"

import { defineJob } from "./scheduler"

export const banLiftJob = defineJob({
  name: "ban-lift",
  schedule: "*/5 * * * *",
  run: () => liftExpiredBans(),
})
