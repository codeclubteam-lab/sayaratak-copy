import { autoBackupJob } from "./auto-backup.job"
import { banLiftJob } from "./ban-lift.job"
import { broadcastFanoutJob } from "./broadcast-fanout.job"
import { listingExpiryJob } from "./listing-expiry.job"
import { orphanUploadsJob } from "./orphan-uploads.job"
import { outboxJob } from "./outbox.job"
import { promotionEndJob } from "./promotion-end.job"
import { pruneJob } from "./prune.job"
import type { Job } from "./scheduler"
import { subscriptionEndJob } from "./subscription-end.job"
import { subscriptionExpiringJob } from "./subscription-expiring.job"
import { unverifiedCleanupJob } from "./unverified-cleanup.job"

/** Every scheduled job (A10), one `*.job.ts` file each. */
export const jobs: Job[] = [
  outboxJob,
  broadcastFanoutJob,
  listingExpiryJob,
  promotionEndJob,
  subscriptionEndJob,
  subscriptionExpiringJob,
  banLiftJob,
  unverifiedCleanupJob,
  orphanUploadsJob,
  autoBackupJob,
  pruneJob,
]
