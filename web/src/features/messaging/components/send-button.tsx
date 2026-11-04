import { SendHorizontalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"

// Sending is optimistic, so the button never shows a pending state; it is off while the box is empty.
export function SendButton({ disabled }: { disabled: boolean }) {
  const { t } = useT()
  return (
    <Button type="submit" disabled={disabled}>
      <SendHorizontalIcon
        aria-hidden="true"
        className="rtl:-scale-x-100"
        data-icon="inline-start"
      />
      {t("messages.send")}
    </Button>
  )
}
