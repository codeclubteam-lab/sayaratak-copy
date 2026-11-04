import { useLayoutEffect, useRef, useState, type ComponentProps } from "react"

import { normalizeDigits } from "@sayaratak/shared/lib/digits"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { Input } from "@/components/ui/input"

type Props = Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange" | "type" | "min" | "max" | "step"
> & {
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  // Thousands separators while typing (whole numbers only).
  grouping?: boolean
}

const parse = (s: string) =>
  s === "" || Number.isNaN(Number(s)) ? null : Number(s)

// Stores number | null: an empty field is null, never 0. Min and max are not enforced while typing (the schema reports them); they only limit the arrow keys.
export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  grouping = false,
  onKeyDown,
  ...props
}: Props) {
  const { locale } = useT()
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const [typed, setTyped] = useState("")
  const decimal = step % 1 !== 0
  const fmt = (n: number | null) =>
    n === null ? "" : grouping ? formatNumber(n, locale) : String(n)
  // What the person typed stays on screen while it still means the current value, so "1." and "007" are not rewritten under the cursor.
  const shown =
    parse(typed.replace(/[^\d.]/g, "")) === value ? typed : fmt(value)

  useLayoutEffect(() => {
    if (caret.current !== null) {
      ref.current?.setSelectionRange(caret.current, caret.current)
      caret.current = null
    }
  })

  const clean = (raw: string) => {
    const s = normalizeDigits(raw)
      .replace("٫", ".")
      .replace(decimal ? /[^\d.]/g : /\D/g, "")
    const [whole = "", ...rest] = s.split(".")
    return rest.length ? `${whole}.${rest.join("")}` : s
  }

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      autoComplete="off"
      value={shown}
      onChange={(e) => {
        const raw = e.target.value
        const next = clean(raw)
        const n = parse(next)
        const text = grouping ? fmt(n) : next
        // Put the cursor after the same number of digits it followed before the separators changed.
        const before = clean(
          raw.slice(0, e.target.selectionStart ?? raw.length)
        ).length
        let seen = 0
        let at = 0
        while (at < text.length && seen < before)
          if (/[\d.]/.test(text[at++]!)) seen++
        caret.current = at
        setTyped(text)
        onChange(n)
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e)
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
        e.preventDefault()
        const delta = e.key === "ArrowUp" ? step : -step
        const next = Math.min(
          max ?? Infinity,
          Math.max(min ?? -Infinity, Number(((value ?? 0) + delta).toFixed(10)))
        )
        setTyped(fmt(next))
        onChange(next)
      }}
    />
  )
}
