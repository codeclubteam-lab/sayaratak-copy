import { useState, type ComponentProps } from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// The eye button is centred in the field at any height. `shown` makes it controlled, so a form can reveal a suggested password in both fields at once.
export function PasswordInput({
  className,
  shown: shownProp,
  onShownChange,
  ...props
}: Omit<ComponentProps<typeof Input>, "type"> & {
  shown?: boolean
  onShownChange?: (shown: boolean) => void
}) {
  const { t } = useT()
  const [own, setOwn] = useState(false)
  const shown = shownProp ?? own
  return (
    <div className="relative">
      <Input
        {...props}
        type={shown ? "text" : "password"}
        className={`pe-14 ${className ?? ""}`}
      />
      <div className="absolute inset-y-0 end-0.5 flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-11"
          aria-label={t(shown ? "form.hide_password" : "form.show_password")}
          aria-pressed={shown}
          onClick={() => {
            setOwn(!shown)
            onShownChange?.(!shown)
          }}
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      </div>
    </div>
  )
}
