import { cleanUp } from "~/modules/uploads/uploads.cleanup.service"

import { defineJob } from "./scheduler"

export const orphanUploadsJob = defineJob({
  name: "orphan-uploads",
  schedule: "20 * * * *",
  run: () => cleanUp(),
})
