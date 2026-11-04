import { useState } from "react"
import { KeyRoundIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import { passwordSchema } from "@sayaratak/shared/schemas/fields"
import { CopyButton } from "./copy-button"

// 64 characters without look-alikes (I, l, O, 0, 1), so a random byte masked to 6 bits picks one without bias.
const alphabet =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?"

export function strongPassword(length = 16) {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(length))
    const pw = Array.from(bytes, (b) => alphabet[b & 63]).join("")
    if (passwordSchema.safeParse(pw).success) return pw
  }
}

// "Suggest a strong password": the form fills its fields and shows them; then a copy button offers the password.
export function PasswordSuggest({ onPick }: { onPick: (pw: string) => void }) {
  const { t } = useT()
  const [picked, setPicked] = useState("")
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ms-3 text-primary"
        onClick={() => {
          const pw = strongPassword()
          setPicked(pw)
          onPick(pw)
        }}
      >
        <KeyRoundIcon aria-hidden data-icon="inline-start" />
        {t("auth.suggest_password")}
      </Button>
      {picked && <CopyButton value={picked} label={t("auth.copy_password")} />}
    </div>
  )
}
