import { useRef, type ReactNode } from "react"
import { XIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ControlProps } from "./form-field"

// `icon` sits before the label, in the list and on the closed field.
export type SelectOption = { value: string; label: string; icon?: ReactNode }

// The shadcn Select on a plain string value, the one dropdown of the app (never a native select element).
// `placeholder` is only the hint on the closed field ("Choose a city"), never a row in the list; a small clear button reports "" once a value is picked.
export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  ...aria
}: Partial<ControlProps> & {
  value: string
  onChange: (value: string) => void
  options: readonly SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const { t } = useT()
  const clearable = Boolean(placeholder && value && !disabled)
  // A list opened near the bottom of the window would flip upward, so the page scrolls first and the field rises (never under the 80px header).
  const makeRoom = (open: boolean) => {
    const box = trigger.current?.getBoundingClientRect()
    if (!open || !box) return
    const need = Math.min(options.length * 48 + 16, 320)
    const gap = Math.min(need - (window.innerHeight - box.bottom), box.top - 80)
    if (gap > 0) window.scrollBy({ top: gap, behavior: "instant" })
  }
  const labelOf = (o: SelectOption) =>
    o.icon ? (
      <span className="flex items-center gap-2">
        {o.icon}
        {o.label}
      </span>
    ) : (
      o.label
    )
  return (
    <div className={cn("relative w-full", className)}>
      <Select
        items={options.map((o) => ({ value: o.value, label: labelOf(o) }))}
        onOpenChange={makeRoom}
        value={value || null}
        disabled={disabled}
        onValueChange={(next) => onChange(next ?? "")}
      >
        <SelectTrigger
          {...aria}
          ref={trigger}
          className={cn("w-full", clearable && "pe-16")}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {labelOf(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {clearable && (
        <button
          type="button"
          aria-label={t("common.clear")}
          onClick={() => onChange("")}
          className="absolute end-9 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground motion-color hover:bg-muted hover:text-foreground"
        >
          <XIcon aria-hidden className="size-3.5" />
        </button>
      )}
    </div>
  )
}
