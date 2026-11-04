import { ShieldCheckIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"

const tips = [
  "listing.safety_1",
  "listing.safety_2",
  "listing.safety_3",
  "listing.safety_4",
] as const

export function SafetyTips() {
  const { t } = useT()
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-muted p-4">
      <h2 className="flex items-center gap-2 text-ui font-semibold">
        <ShieldCheckIcon
          aria-hidden="true"
          strokeWidth={1.5}
          className="size-5"
        />
        {t("listing.safety_title")}
      </h2>
      <ul className="list-disc ps-5 text-ui text-muted-foreground">
        {tips.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
    </section>
  )
}
