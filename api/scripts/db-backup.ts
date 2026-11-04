import { takeBackup } from "~/modules/admin-backups/admin-backups.dump.service"

// Takes a backup from the terminal: bun scripts/db-backup.ts
const backup = await takeBackup({ type: "manual" })
process.stdout.write(`Backup ${backup.id} stored, ${backup.sizeMb} MB\n`)
process.exit(0)
