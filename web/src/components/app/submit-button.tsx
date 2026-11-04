import { useEffect, useState, type ComponentProps } from "react"
import { CheckIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { useDelayedFlag } from "@/lib/use-delayed-flag"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

// Pending: disabled and `aria-busy` at once, a spinner only after 300 ms, and the label stays in the layout so the width never changes.
// `savedLabel` is set by the page after a successful save (for example `mutation.isSuccess`): the label reads "Saved" with a check for 1.5 s.
// `dirty` is for the Save of one section among several: secondary at rest, primary once the section has unsaved changes, so a page shows one primary button (14.2).
export function SubmitButton({
  pending,
  dirty,
  variant,
  disabled,
  savedLabel,
  className,
  children,
  ...props
}: ComponentProps<typeof Button> & {
  pending?: boolean
  dirty?: boolean
  savedLabel?: boolean
}) {
  const { t } = useT()
  const spinner = useDelayedFlag(!!pending, { delayMs: 300, minMs: 0 })
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!savedLabel) return
    setSaved(true)
    const id = window.setTimeout(() => setSaved(false), 1500)
    return () => window.clearTimeout(id)
  }, [savedLabel])
  return (
    <Button
      type="submit"
      {...props}
      variant={dirty === undefined ? variant : dirty ? "default" : "secondary"}
      className={cn("relative", className)}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5",
          spinner && "opacity-0"
        )}
      >
        {saved ? (
          <>
            <CheckIcon aria-hidden="true" />
            {t("common.saved")}
          </>
        ) : (
          children
        )}
      </span>
      {spinner && (
        <Spinner
          role="presentation"
          aria-hidden="true"
          aria-label={undefined}
          className="absolute"
        />
      )}
      <span role="status" className="sr-only">
        {saved ? t("common.saved") : ""}
      </span>
    </Button>
  )
}
