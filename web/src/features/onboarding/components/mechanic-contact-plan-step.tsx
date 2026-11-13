import { useFormContext } from "react-hook-form"

import type { MechanicContactPlan } from "../schemas"
import { PhoneField } from "./phone-field"
import { PlanStep } from "./plan-step"
import { WhatsappField } from "./whatsapp-field"

export function MechanicContactPlanStep() {
  const { watch } = useFormContext<MechanicContactPlan>()
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <PhoneField />
        <WhatsappField first={watch("phone")} />
      </div>
      <PlanStep audience="mechanic" />
    </>
  )
}
