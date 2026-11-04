import { useId, useLayoutEffect, useRef, useState } from "react"

import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// Six lines, then "Read more". The button shows only when the text really overflows; before the first measurement a long text assumes it does, so the server HTML and the first paint agree.
export function Description({ text }: { text: string }) {
  const { t } = useT()
  const id = useId()
  const box = useRef<HTMLParagraphElement>(null)
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(text.length > 280)
  useLayoutEffect(() => {
    const el = box.current
    if (!el || open) return
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text, open])
  return (
    <div className="flex flex-col items-start gap-2">
      <p
        id={id}
        ref={box}
        className={cn(
          "max-w-[70ch] text-body [text-wrap:pretty] whitespace-pre-line",
          !open && "line-clamp-6"
        )}
      >
        {text}
      </p>
      {(overflows || open) && (
        <Button
          type="button"
          variant="link"
          className="px-0"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          {t(open ? "listing.read_less" : "listing.read_more")}
        </Button>
      )}
    </div>
  )
}
