import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { ar, enUS } from "react-day-picker/locale"

import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Weeks start on Saturday. The picked Date is local midnight; it is shown through Khartoum time from the same calendar day at noon UTC, so no time zone moves the day.
export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  ...control
}: {
  value?: Date
  onChange: (value: Date | undefined) => void
  placeholder?: string
  disabled?: React.ComponentProps<typeof Calendar>["disabled"]
  id?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}) {
  const { t, locale } = useT()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            {...control}
            type="button"
            variant="outline"
            className="w-full justify-start bg-(--field)"
          />
        }
      >
        <CalendarIcon data-icon="inline-start" />
        {value
          ? formatDate(
              new Date(
                Date.UTC(
                  value.getFullYear(),
                  value.getMonth(),
                  value.getDate(),
                  12
                )
              ).toISOString(),
              locale
            )
          : (placeholder ?? t("form.pick_date"))}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value}
          disabled={disabled}
          weekStartsOn={6}
          numerals="latn"
          dir={locale === "ar" ? "rtl" : "ltr"}
          locale={locale === "ar" ? ar : enUS}
          onSelect={(date) => {
            onChange(date)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
