import { useEffect, useState, type ReactNode } from "react"
import { ChevronDownIcon } from "lucide-react"

import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"

// One block of the filter form: a heading that opens and closes its fields, on a native <details>. `active` is how many filters inside are set; it shows on the heading, and a closed block opens itself when one gets set (a chip, a saved search, the back button). It never closes by itself.
export function FilterSection({
  title,
  active = 0,
  defaultOpen = false,
  children,
}: {
  title: string
  active?: number
  defaultOpen?: boolean
  children: ReactNode
}) {
  const { t, locale } = useT()
  const [open, setOpen] = useState(defaultOpen || active > 0)
  useEffect(() => {
    if (active > 0) setOpen(true)
  }, [active])
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group"
    >
      <summary className="flex min-h-(--control-h) cursor-pointer list-none items-center gap-2 rounded-lg text-ui font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        {active > 0 && (
          <>
            <span
              aria-hidden="true"
              className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-caption font-medium text-primary-foreground"
            >
              {formatNumber(active, locale)}
            </span>
            <span className="sr-only">
              {t("search.section_active", { n: active })}
            </span>
          </>
        )}
        <ChevronDownIcon
          aria-hidden="true"
          className="ms-auto size-4 shrink-0 text-muted-foreground transition-transform duration-(--dur-fast) ease-(--ease-standard) group-open:rotate-180"
        />
      </summary>
      <div className="flex flex-col gap-3 pt-1 pb-3">{children}</div>
    </details>
  )
}
