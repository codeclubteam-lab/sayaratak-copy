import { ArrowLeftIcon } from "lucide-react"

import { ShellLink } from "@/components/app/shell-link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { initials } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { Thread } from "@sayaratak/shared/schemas/messaging"
import { counterpart } from "../counterpart"

const basePath = {
  listing: "listing",
  dealership: "dealerships",
  workshop: "workshops",
  mechanic: "mechanics",
} as const

// Who you are talking to and what about. The subject opens in a new tab so the conversation stays open; below `lg` a back button returns to the list.
export function ThreadHeader({
  thread,
  meId,
  onBack,
}: {
  thread: Thread
  meId: string
  onBack: () => void
}) {
  const { t, locale } = useT()
  const other = counterpart(thread, meId)
  const title = thread.subjectTitle[locale]
  return (
    <header className="flex items-center gap-3 p-3">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label={t("messages.back")}
        onClick={onBack}
      >
        <ArrowLeftIcon aria-hidden="true" className="rtl:rotate-180" />
      </Button>
      <Avatar size="lg">
        <AvatarImage src={other?.avatarUrl ?? undefined} alt="" />
        <AvatarFallback>{initials(other?.name ?? "")}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <h2 className="truncate text-ui font-semibold">
          <bdi>{other?.name}</bdi>
        </h2>
        {thread.subjectSlug ? (
          <ShellLink
            path={`/${basePath[thread.subjectType]}/${thread.subjectSlug}`}
            newTab
            className="truncate text-caption text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            <bdi>{title}</bdi>
          </ShellLink>
        ) : (
          <p className="truncate text-caption text-muted-foreground">
            <bdi>{title}</bdi>
          </p>
        )}
      </div>
    </header>
  )
}
