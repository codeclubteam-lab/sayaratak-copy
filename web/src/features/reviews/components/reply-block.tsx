import { useEffect, useRef, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import type { Review } from "@sayaratak/shared/schemas/review"
import { ReplyForm } from "./reply-form"

// The owner's reply under a review: the text with "Edit", or a "Reply" button, and the form in place of either. A hidden review takes no reply, so it shows an old one at most. `children` are the other actions, kept beside "Reply" or under the reply text.
export function ReplyBlock({
  review,
  children,
}: {
  review: Review
  children?: ReactNode
}) {
  const { t } = useT()
  const [editing, setEditing] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const back = useRef<"saved" | "cancelled" | null>(null)
  // The form unmounts on close; put focus back on the button that replaces it. After a first reply that button exists only once the refreshed review arrives, a moment after the form closes.
  useEffect(() => {
    if (editing || !back.current) return
    if (back.current === "saved" && !review.reply) return
    trigger.current?.focus()
    back.current = null
  }, [editing, review.reply])
  const close = (saved?: boolean) => {
    back.current = saved ? "saved" : "cancelled"
    setEditing(false)
  }
  if (editing) return <ReplyForm review={review} onDone={close} />
  if (review.status === "hidden" && !review.reply) return null
  return review.reply ? (
    <>
      <div className="ms-6 flex flex-col gap-1 rounded-lg bg-muted p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-caption font-semibold">
            {t("reviews.owner_reply")}
          </span>
          {review.status !== "hidden" && (
            <Button
              ref={trigger}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
            >
              {t("reviews_manager.reply_edit")}
            </Button>
          )}
        </div>
        <p className="text-ui" dir="auto">
          {review.reply.body}
        </p>
      </div>
      {children}
    </>
  ) : (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        ref={trigger}
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setEditing(true)}
      >
        {t("reviews_manager.reply")}
      </Button>
      {children}
    </div>
  )
}
