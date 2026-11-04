import type { AdminBusiness } from "@sayaratak/shared/schemas/admin"

// What the admin asked to change on a business; the page asks first, then saves.
export type BusinessChange = {
  business: AdminBusiness
  action: "verify" | "unverify" | "suspend" | "reactivate"
}
