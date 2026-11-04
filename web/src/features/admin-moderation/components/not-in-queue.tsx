import { SearchXIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/app/empty-state"
import { buttonVariants } from "@/components/ui/button"

// A link (an old notification, another admin's tab) to a listing someone already decided on.
export function NotInQueue({ id }: { id: string }) {
  const { t, locale } = useT()
  return (
    <EmptyState
      icon={SearchXIcon}
      title={t("admin.not_in_queue")}
      body={t("admin.not_in_queue_body")}
      className="rounded-xl bg-card"
      action={
        <a
          href={localeHref(`/admin/listings?id=${id}`, locale)}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          {t("admin.open_in_listings")}
        </a>
      }
    />
  )
}
