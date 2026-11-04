import { pruneExpired } from "~/modules/auth/auth.cleanup.service"
import { pruneStale } from "~/modules/devices/devices.service"
import { rollUpOldDays } from "~/modules/analytics/analytics.rollup.service"
import { pruneRead } from "~/modules/notifications/notifications.cleanup.service"
import { pruneOutbox } from "~/modules/notifications/notifications.outbox.service"
import { pruneKeys } from "~/shared/http/idempotency.prune"

import { defineJob } from "./scheduler"

export const pruneJob = defineJob({
  name: "prune",
  schedule: "0 3 * * *",
  run: async () => {
    // One after the other: they all delete in batches, and nobody is waiting on this.
    let deleted = 0
    for (const prune of [
      pruneExpired,
      pruneOutbox,
      pruneKeys,
      pruneStale,
      pruneRead,
      rollUpOldDays,
    ])
      deleted += await prune()
    return deleted
  },
})
