import {
  FANOUT_JOB,
  fanOut,
} from "~/modules/notifications/notifications.fanout.service"

import { defineJob } from "./scheduler"

export const broadcastFanoutJob = defineJob({
  name: FANOUT_JOB,
  schedule: "* * * * *",
  run: () => fanOut(),
})
