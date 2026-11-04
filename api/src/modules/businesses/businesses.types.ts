import type { Geo, WeeklyHours } from "@sayaratak/shared/schemas/fields"

import type {
  dealerships,
  mechanics,
  portfolioItems,
  workshops,
  workshopServices,
} from "./businesses.tables"

export type BusinessKind = "dealership" | "workshop" | "mechanic"

type Basics = {
  ownerUserId: string
  name: string
  cityId: string
  whatsapp: string | null
}

// What a dealership and a workshop share: a street address with an optional
// pin, opening hours, a logo and a cover.
type Place = {
  districtId: string | null
  address: string
  location: Geo | null
  hours: WeeklyHours
  description: string
  logoUploadId: string | null
  coverUploadId: string | null
}

export type NewService = {
  name: string
  description: string
  priceFrom: number | null
  templateId: string | null
}

export type NewDealership = Basics & Place & { phones: string[] }
export type NewWorkshop = Basics &
  Place & { phone: string; services: NewService[] }
export type NewMechanic = Basics & {
  phone: string
  bio: string
  photoUploadId: string | null
  yearsOfExperience: number
  servedCityIds: string[]
  specializationIds: string[]
}

/** A business as onboarding creates it; text is typed once and stored in both languages. */
export type NewBusiness =
  | ({ kind: "dealership" } & NewDealership)
  | ({ kind: "workshop" } & NewWorkshop)
  | ({ kind: "mechanic" } & NewMechanic)

export type DealershipRow = typeof dealerships.$inferSelect
export type WorkshopRow = typeof workshops.$inferSelect
export type MechanicRow = typeof mechanics.$inferSelect
export type ServiceRow = typeof workshopServices.$inferSelect
export type PortfolioRow = typeof portfolioItems.$inferSelect
