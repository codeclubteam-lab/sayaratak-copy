import { useState } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"

// `label` says what is copied ("Copy listing ID"). The icon becomes a check for 1.5 s and a polite live region says "Copied". Inside a menu that closes, use the toast variant instead (`ShareMenu`).
export function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useT()
  const [done, setDone] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).then(
      () => {
        setDone(true)
        window.setTimeout(() => setDone(false), 1500)
      },
      () => toast.add({ title: t("common.copy_failed") })
    )
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={copy}
    >
      {done ? (
        <CheckIcon aria-hidden="true" />
      ) : (
        <CopyIcon aria-hidden="true" />
      )}
      <span role="status" className="sr-only">
        {done ? t("common.copied") : ""}
      </span>
    </Button>
  )
}
