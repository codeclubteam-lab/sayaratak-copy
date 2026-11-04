import { useId } from "react"

import { AvailabilitySwitch } from "./availability-switch"
import { useT } from "@/lib/i18n/use-t"

// "Available for new work" on the overview; the profile page shows the same switch in its own section.
export function AvailabilityCard() {
  const { t } = useT()
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 rounded-xl bg-card p-5"
    >
      <h2 id={id} className="text-body font-semibold">
        {t("dashboard.availability_title")}
      </h2>
      <AvailabilitySwitch />
    </section>
  )
}
