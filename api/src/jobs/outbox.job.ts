import { sendDue } from "~/modules/notifications/notifications.outbox.service"

import { defineJob } from "./scheduler"

export const outboxJob = defineJob({
  name: "outbox",
  schedule: "* * * * *",
  run: () => sendDue(),
})
