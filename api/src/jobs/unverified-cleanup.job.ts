import { deleteUnfinishedSignUps } from "~/modules/auth/auth.cleanup.service"

import { defineJob } from "./scheduler"

export const unverifiedCleanupJob = defineJob({
  name: "unverified-cleanup",
  schedule: "10 * * * *",
  run: () => deleteUnfinishedSignUps(),
})
