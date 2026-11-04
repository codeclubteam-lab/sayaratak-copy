import { CheckCheckIcon, CheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatTime } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { ChatRow } from "../chat-row"

// Own messages sit at the end side with the primary fill (Decisions log 2026-10-08), the other person's at the start side with the muted fill. No borders.
export function MessageBubble({
  row,
  own,
  onRetry,
  onDiscard,
}: {
  row: ChatRow
  own: boolean
  onRetry: (row: ChatRow) => void
  onDiscard: (row: ChatRow) => void
}) {
  const { t, locale } = useT()
  const failed = row.state === "failed"
  return (
    <li className={`flex flex-col gap-1 ${own ? "items-end" : "items-start"}`}>
      <p
        dir="auto"
        className={`max-w-[80%] rounded-xl px-3 py-2 text-body wrap-break-word whitespace-pre-wrap ${
          own
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        } ${row.state === "sending" ? "opacity-60" : ""}`}
      >
        {row.body}
      </p>
      {failed ? (
        <p className="flex items-center gap-2 text-caption text-destructive">
          {t("messages.not_sent")}
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={() => onRetry(row)}
          >
            {t("messages.retry")}
          </Button>
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={() => onDiscard(row)}
          >
            {t("messages.discard")}
          </Button>
        </p>
      ) : (
        row.state !== "sending" && (
          <p className="flex items-center gap-1 text-caption text-muted-foreground">
            <time dateTime={row.createdAt}>
              {formatTime(row.createdAt, locale)}
            </time>
            {own &&
              (row.readAt ? (
                <>
                  <CheckCheckIcon
                    aria-hidden="true"
                    className="size-4 text-primary"
                  />
                  <span className="sr-only">{t("messages.tick_read")}</span>
                </>
              ) : (
                <>
                  <CheckIcon aria-hidden="true" className="size-4" />
                  <span className="sr-only">{t("messages.tick_sent")}</span>
                </>
              ))}
          </p>
        )
      )}
    </li>
  )
}
