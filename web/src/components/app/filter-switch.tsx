import { useId } from "react"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

// A toolbar toggle named by its own text (`aria-labelledby`, because the label wraps the switch).
export function FilterSwitch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (on: boolean) => void
}) {
  const id = useId()
  return (
    <Label className="min-h-11 gap-3 md:min-h-0">
      <Switch
        aria-labelledby={id}
        checked={checked}
        onCheckedChange={onChange}
      />
      <span id={id}>{label}</span>
    </Label>
  )
}
