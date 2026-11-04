import { MakeModelFields } from "@/components/app/make-model-fields"
import type { VehicleType } from "@sayaratak/shared/schemas/listing"
import { useStepFields } from "./use-step-fields"

// Make and model of the details step, stored as four plain fields of the one form.
// `inGrid` lays make and model as two cells of the parent grid, so they line up with the fields below.
export function DetailsMakeModel({
  vehicleType,
  inGrid = false,
}: {
  vehicleType?: VehicleType | null
  inGrid?: boolean
}) {
  const { values, error, set } = useStepFields()
  return (
    <MakeModelFields
      vehicleType={vehicleType}
      {...(inGrid && { className: "contents", alwaysModel: true })}
      value={{
        makeId: values.makeId,
        modelId: values.modelId,
        makeOther: values.makeOther,
        modelOther: values.modelOther,
      }}
      onChange={(next) => {
        for (const [field, value] of Object.entries(next)) set(field, value)
      }}
      makeError={error("makeId") ?? error("makeOther")}
      modelError={error("modelId") ?? error("modelOther")}
    />
  )
}
