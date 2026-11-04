import { useId, useState } from "react"

import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { MakeTile } from "@/components/app/make-tile"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { useMakes } from "../use-makes"

// Always two full rows: 4 columns on a phone (8 tiles), 6 from md (12), 8 from lg (16). Tiles past the count for a width are hidden by their breakpoint.
const hideBelow = (i: number) =>
  i >= 12 ? "hidden lg:block" : i >= 8 ? "hidden md:block" : ""

// The most popular makes (the first sixteen in the taxonomy order, which the admin controls); "Show more" opens every make in a dialog, or a bottom sheet on a phone.
export function MakeGrid() {
  const { t, locale } = useT()
  const id = useId()
  const [open, setOpen] = useState(false)
  const { makes, countOf } = useMakes()
  if (!makes.length) return null
  const all = [...makes].sort((a, b) =>
    a.name[locale].localeCompare(b.name[locale], locale)
  )
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id={id} className="text-title font-semibold">
          {t("home.makes")}
        </h2>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="ms-auto inline-flex min-h-11 min-w-11 shrink-0 items-center justify-end text-ui font-medium text-primary hover:underline md:min-h-0"
        >
          {t("home.makes_more")}
        </button>
      </div>
      <ul className="grid grid-cols-4 gap-x-3 gap-y-6 md:grid-cols-6 md:gap-x-4 lg:grid-cols-8">
        {makes.slice(0, 16).map((m, i) => {
          const count = countOf(m.id)
          return (
            <li key={m.id} className={hideBelow(i)}>
              <MakeTile
                make={m}
                count={
                  count === undefined ? undefined : formatNumber(count, locale)
                }
              />
            </li>
          )
        })}
      </ul>
      <ResponsiveDialog
        wide
        // The page colour, so a tile looks here as it does on the home page (the dialog's own white makes the same grey look darker).
        className="bg-background"
        open={open}
        onOpenChange={setOpen}
        title={t("home.makes_all")}
      >
        <ul className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-6 md:gap-x-4">
          {all.map((m) => {
            const count = countOf(m.id)
            return (
              <li key={m.id}>
                <MakeTile
                  make={m}
                  count={
                    count === undefined
                      ? undefined
                      : t("search.results_count", { count })
                  }
                />
              </li>
            )
          })}
        </ul>
      </ResponsiveDialog>
    </section>
  )
}
