import type {
  Dealership,
  Mechanic,
  Workshop,
} from "@sayaratak/shared/schemas/profile"

export type SetupItem = { key: string; done: boolean; href: string }

// What each dashboard overview asks for (A9 10.2, 11.2, 12.2). Paths are locale-free. Verification is done while a request waits for review (`pending`) or once the business has the badge (a seed or admin can verify with no request); a rejected request opens it again.
export function setupItems(
  b: Dealership | Workshop | Mechanic,
  pending: boolean
): SetupItem[] {
  const verified = pending || b.verified
  const item = (key: string, done: boolean, href: string) => ({
    key,
    done,
    href,
  })
  if ("photoUrl" in b)
    return [
      item("dashboard.setup_photo", Boolean(b.photoUrl), "/mechanic/profile"),
      item(
        "dashboard.setup_bio",
        Boolean(b.bio.ar || b.bio.en),
        "/mechanic/profile"
      ),
      item(
        "dashboard.setup_specializations",
        b.specializationIds.length > 0,
        "/mechanic/profile"
      ),
      item(
        "dashboard.setup_portfolio",
        b.portfolio.length >= 3,
        "/mechanic/portfolio"
      ),
      item("dashboard.setup_verification", verified, "/mechanic/verification"),
    ]
  const hours = b.hours.some((d) => !d.closed)
  if ("services" in b)
    return [
      item("dashboard.setup_logo", Boolean(b.logoUrl), "/workshop/profile"),
      item(
        "dashboard.setup_description",
        Boolean(b.description.ar || b.description.en),
        "/workshop/profile"
      ),
      item("dashboard.setup_hours", hours, "/workshop/profile"),
      item(
        "dashboard.setup_services",
        b.services.length >= 3,
        "/workshop/services"
      ),
      item("dashboard.setup_photos", b.images.length >= 3, "/workshop/photos"),
      item("dashboard.setup_verification", verified, "/workshop/verification"),
    ]
  return [
    item("dashboard.setup_logo", Boolean(b.logoUrl), "/dealer/profile"),
    item("dashboard.setup_cover", Boolean(b.coverUrl), "/dealer/profile"),
    item(
      "dashboard.setup_description",
      Boolean(b.description.ar || b.description.en),
      "/dealer/profile"
    ),
    item("dashboard.setup_hours", hours, "/dealer/profile"),
    item(
      "dashboard.setup_first_vehicle",
      b.inventoryCount > 0,
      "/dealer/inventory/new"
    ),
    item("dashboard.setup_verification", verified, "/dealer/verification"),
  ]
}
