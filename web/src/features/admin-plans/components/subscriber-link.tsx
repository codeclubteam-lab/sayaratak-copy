import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { AdminSubscription } from "@sayaratak/shared/schemas/admin"

const businessPage = {
  dealership: "dealerships",
  workshop: "workshops",
  mechanic: "mechanics",
} as const

// The holder's name, opening their business in its admin table, or the person's account.
export function SubscriberLink({ sub }: { sub: AdminSubscription }) {
  const { locale } = useT()
  const { audience } = sub.plan
  const path =
    audience !== "user" && sub.subscriber.businessId
      ? `/admin/${businessPage[audience]}?id=${sub.subscriber.businessId}`
      : `/admin/users?id=${sub.userId}`
  return (
    <a
      href={localeHref(path, locale)}
      className="inline-flex min-h-11 items-center text-ui font-medium underline-offset-4 motion-color hover:text-primary hover:underline"
    >
      <bdi>{sub.subscriber.name[locale]}</bdi>
    </a>
  )
}
