import { formatWeekday } from "@/lib/format"
import { khartoumDay, SAT_FIRST } from "@/lib/hours"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { WeeklyHours } from "@sayaratak/shared/schemas/fields"

// The week from Saturday, today marked with weight and a tint (and `aria-current`, so it never rests on color alone).
export function HoursTable({ hours }: { hours: WeeklyHours }) {
  const { t, locale } = useT()
  const today = khartoumDay(useNow())
  return (
    <table className="w-full max-w-sm text-ui">
      <caption className="sr-only">{t("directory.hours_title")}</caption>
      <tbody>
        {SAT_FIRST.map((day) => {
          const row = hours.find((h) => h.day === day)
          return (
            <tr
              key={day}
              aria-current={day === today ? "date" : undefined}
              className={day === today ? "bg-accent font-semibold" : undefined}
            >
              <th scope="row" className="py-2 ps-3 text-start font-[inherit]">
                {formatWeekday(day, locale)}
              </th>
              <td className="py-2 pe-3 text-end">
                {!row || row.closed ? (
                  <span className="text-muted-foreground">
                    {t("hours.closed")}
                  </span>
                ) : (
                  <bdi dir="ltr" className="num">
                    {row.open} – {row.close}
                  </bdi>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
