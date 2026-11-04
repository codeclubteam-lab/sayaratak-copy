import {
  createElement,
  lazy,
  type ComponentType,
  type LazyExoticComponent,
} from "react"
import type { FieldValues } from "react-hook-form"
import type { z } from "zod"

import { defaultWeeklyHours } from "@/lib/hours"
import type { User } from "@sayaratak/shared/schemas/user"
import {
  dealerBusinessSchema,
  dealerLocationSchema,
  hoursStepSchema,
  mechanicAboutSchema,
  mechanicContactPlanSchema,
  mechanicExpertiseSchema,
  planStepSchema,
  userOnboardingSchema,
  workshopBusinessSchema,
  workshopHoursServicesSchema,
  workshopLocationSchema,
  type OnboardingRole,
} from "./schemas"

// Step bodies load on first use, so the guards and the route loader that read `flows` do not pull the forms into the first load.
const BusinessStep = lazy(() =>
  import("./components/business-step").then((m) => ({
    default: m.BusinessStep,
  }))
)
const DealerLocationStep = lazy(() =>
  import("./components/dealer-location-step").then((m) => ({
    default: m.DealerLocationStep,
  }))
)
const HoursStep = lazy(() =>
  import("./components/hours-step").then((m) => ({ default: m.HoursStep }))
)
const MechanicAboutStep = lazy(() =>
  import("./components/mechanic-about-step").then((m) => ({
    default: m.MechanicAboutStep,
  }))
)
const MechanicContactPlanStep = lazy(() =>
  import("./components/mechanic-contact-plan-step").then((m) => ({
    default: m.MechanicContactPlanStep,
  }))
)
const MechanicExpertiseStep = lazy(() =>
  import("./components/mechanic-expertise-step").then((m) => ({
    default: m.MechanicExpertiseStep,
  }))
)
const PlanStep = lazy(() =>
  import("./components/plan-step").then((m) => ({ default: m.PlanStep }))
)
const UserDetailsStep = lazy(() =>
  import("./components/user-details-step").then((m) => ({
    default: m.UserDetailsStep,
  }))
)
const WorkshopHoursServicesStep = lazy(() =>
  import("./components/workshop-hours-services-step").then((m) => ({
    default: m.WorkshopHoursServicesStep,
  }))
)
const WorkshopLocationStep = lazy(() =>
  import("./components/workshop-location-step").then((m) => ({
    default: m.WorkshopLocationStep,
  }))
)

export type FlowStep = {
  id: string
  titleKey: string
  helperKey: string
  schema: z.ZodType<FieldValues, FieldValues>
  optional?: boolean
  // Uses the full page width with no preview beside it (the plan cards).
  wide?: boolean
  // Starting values for a step with no saved draft, e.g. the account name.
  defaults?: (me: User) => FieldValues
  Component: ComponentType | LazyExoticComponent<ComponentType>
}

// Steps shared by the dealership and workshop flows take their audience as a prop.
const businessStep = (kind: "dealership" | "workshop") => () =>
  createElement(BusinessStep, { kind })
const planStep = (audience: "dealership" | "workshop") => () =>
  createElement(PlanStep, { audience })

const step = (role: OnboardingRole, id: string) => {
  const key = `onboarding.step_${role}_${id.replaceAll("-", "_")}`
  return { id, titleKey: `${key}_title`, helperKey: `${key}_helper` }
}

export const flows = {
  user: [
    {
      ...step("user", "details"),
      schema: userOnboardingSchema,
      defaults: (me) => ({
        cityId: me.cityId ?? "",
        interests: [],
      }),
      Component: UserDetailsStep,
    },
  ],
  dealership: [
    {
      ...step("dealership", "business"),
      schema: dealerBusinessSchema,
      defaults: () => ({ name: "", description: "" }),
      Component: businessStep("dealership"),
    },
    {
      ...step("dealership", "location"),
      schema: dealerLocationSchema,
      defaults: (me) => ({
        cityId: me.cityId ?? "",
        districtId: "",
        address: "",
        location: null,
        phones: [{ value: me.phone ?? "" }],
        whatsapp: "",
      }),
      Component: DealerLocationStep,
    },
    {
      ...step("dealership", "hours"),
      schema: hoursStepSchema,
      defaults: () => ({ hours: defaultWeeklyHours }),
      Component: HoursStep,
    },
    {
      ...step("dealership", "plan"),
      schema: planStepSchema,
      defaults: () => ({ planId: "" }),
      wide: true,
      Component: planStep("dealership"),
    },
  ],
  workshop: [
    {
      ...step("workshop", "business"),
      schema: workshopBusinessSchema,
      defaults: () => ({ name: "", description: "" }),
      Component: businessStep("workshop"),
    },
    {
      ...step("workshop", "location"),
      schema: workshopLocationSchema,
      defaults: (me) => ({
        cityId: me.cityId ?? "",
        districtId: "",
        address: "",
        location: null,
        phone: me.phone ?? "",
        whatsapp: "",
      }),
      Component: WorkshopLocationStep,
    },
    {
      ...step("workshop", "hours-services"),
      schema: workshopHoursServicesSchema,
      defaults: () => ({ hours: defaultWeeklyHours, services: [] }),
      Component: WorkshopHoursServicesStep,
    },
    {
      ...step("workshop", "plan"),
      schema: planStepSchema,
      defaults: () => ({ planId: "" }),
      wide: true,
      Component: planStep("workshop"),
    },
  ],
  mechanic: [
    {
      ...step("mechanic", "about"),
      schema: mechanicAboutSchema,
      defaults: (me) => ({
        name: me.fullName,
        yearsOfExperience: null,
        bio: "",
      }),
      Component: MechanicAboutStep,
    },
    {
      ...step("mechanic", "expertise"),
      schema: mechanicExpertiseSchema,
      defaults: (me) => ({
        specializationIds: [],
        cityId: me.cityId ?? "",
        servedCityIds: [],
      }),
      Component: MechanicExpertiseStep,
    },
    {
      ...step("mechanic", "contact-plan"),
      schema: mechanicContactPlanSchema,
      defaults: (me) => ({
        phone: me.phone ?? "",
        whatsapp: "",
        planId: "",
      }),
      Component: MechanicContactPlanStep,
    },
  ],
} satisfies Record<OnboardingRole, FlowStep[]>

export const isRole = (value: string): value is OnboardingRole =>
  Object.hasOwn(flows, value)

export const firstStepId = (role: OnboardingRole) => flows[role][0]?.id ?? ""
