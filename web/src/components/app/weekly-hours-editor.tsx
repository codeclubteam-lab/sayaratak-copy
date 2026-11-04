import { formatWeekday } from "@/lib/format"
import { SAT_FIRST } from "@/lib/hours"
import { useT } from "@/lib/i18n/use-t"
import type { WeeklyHours } from "@sayaratak/shared/schemas/fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FieldError } from "./field-error"

const preset = (open: string, close: string, closedDay?: number): WeeklyHours =>
  Array.from({ length: 7 }, (_, day) => ({
    day,
    closed: day === closedDay,
    open,
    close,
  }))

export function WeeklyHoursEditor({
  value,
  onChange,
  error,
}: {
  value: WeeklyHours
  onChange: (value: WeeklyHours) => void
  error?: string
}) {
  const { t, locale } = useT()
  const patch = (day: number, change: Partial<WeeklyHours[number]>) =>
    onChange(value.map((r) => (r.day === day ? { ...r, ...change } : r)))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ui font-medium">{t("form.presets")}</span>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange(preset("08:00", "17:00", 5))}
        >
          {t("form.preset_business")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange(preset("08:00", "22:00"))}
        >
          {t("form.preset_daily")}
        </Button>
      </div>
      {SAT_FIRST.map((day) => {
        const row = value.find((r) => r.day === day)
        if (!row) return null
        const name = formatWeekday(day, locale)
        const invalid = !row.closed && row.open >= row.close
        return (
          <div
            key={day}
            role="group"
            aria-label={name}
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3"
          >
            {/* Phone: day and Closed, then the open-close pair, then Copy; one line from sm. */}
            <div className="flex items-center justify-between gap-3 sm:contents">
              <span className="w-24 text-ui font-medium">{name}</span>
              <Label className="min-h-(--row-h) font-normal">
                <Checkbox
                  checked={row.closed}
                  onCheckedChange={(closed) => patch(day, { closed })}
                />
                {t("hours.closed")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                dir="ltr"
                className="w-36"
                aria-label={`${t("form.open_from")}, ${name}`}
                aria-invalid={invalid}
                disabled={row.closed}
                value={row.open}
                onChange={(e) => patch(day, { open: e.target.value })}
              />
              <span aria-hidden="true">–</span>
              <Input
                type="time"
                dir="ltr"
                className="w-36"
                aria-label={`${t("form.close_at")}, ${name}`}
                aria-invalid={invalid}
                disabled={row.closed}
                value={row.close}
                onChange={(e) => patch(day, { close: e.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              className="-ms-4 self-start sm:self-auto"
              aria-label={`${t("form.copy_to_all")}, ${name}`}
              onClick={() =>
                onChange(value.map((r) => ({ ...row, day: r.day })))
              }
            >
              {t("form.copy_to_all")}
            </Button>
          </div>
        )
      })}
      <FieldError message={error} />
    </div>
  )
}
