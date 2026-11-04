import type { Campaign } from "@sayaratak/shared/schemas/ads"

// What the advertiser sees: an approved campaign is scheduled, running or ended by its dates.
export type CampaignState =
  Exclude<Campaign["status"], "approved"> | "scheduled" | "running" | "ended"

export function campaignState(c: Campaign, now: number): CampaignState {
  if (c.status !== "approved") return c.status
  if (now < Date.parse(c.startsAt)) return "scheduled"
  return now < Date.parse(c.endsAt) ? "running" : "ended"
}

export const stateVariant = {
  pending_payment: "warning",
  under_review: "warning",
  rejected: "destructive",
  scheduled: "primary",
  running: "success",
  ended: "muted",
} as const satisfies Record<CampaignState, string>
