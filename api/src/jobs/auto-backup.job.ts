import { autoBackup } from "~/modules/admin-backups/admin-backups.auto.service"

import { defineJob } from "./scheduler"

export const autoBackupJob = defineJob({
  name: "auto-backup",
  schedule: "0 2 * * *",
  run: () => autoBackup(),
})
