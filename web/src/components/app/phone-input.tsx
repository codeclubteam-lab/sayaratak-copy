import type { ComponentProps } from "react"

import { normalizeDigits } from "@sayaratak/shared/lib/digits"
import { normalizePhone } from "@sayaratak/shared/lib/phone"
import { Input } from "@/components/ui/input"

const PREFIX = "+249"

type Props = Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> & {
  value: string
  onChange: (value: string) => void
}

// The +249 chip is display only. The stored value is E.164 after blur; while typing it is whatever the person entered, with Arabic-Indic digits already converted.
export function PhoneInput({ value, onChange, onBlur, ...props }: Props) {
  const prefixed = value.startsWith(PREFIX)
  return (
    <div dir="ltr" className="flex gap-2">
      <span className="flex h-(--control-h) items-center rounded-lg border border-input bg-(--field) px-3 text-ui">
        {PREFIX}
      </span>
      <Input
        {...props}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={prefixed ? value.slice(PREFIX.length) : value}
        onChange={(e) => {
          const next = normalizeDigits(e.target.value).replace(/[^\d+]/g, "")
          onChange(prefixed && next ? PREFIX + next : next)
        }}
        onPaste={(e) => {
          e.preventDefault()
          onChange(normalizePhone(e.clipboardData.getData("text")))
        }}
        onBlur={(e) => {
          if (value) onChange(normalizePhone(value))
          onBlur?.(e)
        }}
      />
    </div>
  )
}
