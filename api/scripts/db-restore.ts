import { restoreBackup } from "~/modules/admin-backups/admin-backups.restore.service"

// Restores the database from a backup (A2): bun scripts/db-restore.ts <backup id> [--force]
// Stop the API first; --force skips that check.
const [id, ...flags] = Bun.argv.slice(2)
if (!id) {
  process.stderr.write(
    "Usage: bun scripts/db-restore.ts <backup id> [--force]\n"
  )
  process.exit(2)
}
const answer = prompt(
  `This replaces the WHOLE database with backup ${id}. Type RESTORE to go on:`
)
if (answer !== "RESTORE") {
  process.stdout.write("Cancelled, nothing changed.\n")
  process.exit(1)
}
const { safetyBackupId } = await restoreBackup(id, {
  force: flags.includes("--force"),
})
process.stdout.write(
  `Restored from ${id}. The state before is saved as backup ${safetyBackupId}.\n`
)
process.exit(0)
