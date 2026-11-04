import type { ReactNode } from "react"

import { useSentinel } from "@/hooks/use-sentinel"
import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"

// Fixed to the bottom, so the page needs bottom padding of about 5rem. The 1 px top line is the one A5 allows on sticky layers; it shows only while content is still below the bar.
export function StickyFooter({
  onBack,
  skip,
  width = "max-w-xl",
  children,
}: {
  onBack?: () => void
  skip?: ReactNode
  // Max width class of the buttons row, so it lines up with the page column.
  width?: string
  children: ReactNode
}) {
  const { t } = useT()
  const [sentinel, contentBelow] = useSentinel<HTMLDivElement>()
  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] motion-color ${contentBelow ? "border-border" : "border-transparent"}`}
      >
        <div className={`mx-auto flex w-full ${width} items-center gap-3`}>
          {onBack && (
            <Button type="button" variant="ghost" onClick={onBack}>
              {t("common.back")}
            </Button>
          )}
          <div className="ms-auto flex items-center gap-3">
            {skip}
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
