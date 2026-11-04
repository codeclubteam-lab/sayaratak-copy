import { useT } from "@/lib/i18n/use-t"
import { formatNumber } from "@/lib/format"
import { localeHref } from "@/lib/navigation"
import type { Listing, ListingStatus } from "@sayaratak/shared/schemas/listing"
import type { User } from "@sayaratak/shared/schemas/user"
import { SelectInput } from "@/components/app/select-input"
import { buttonVariants } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useSetListingStatus } from "../queries"

// Where the owner manages the listing. Promote and Analytics are row actions of the listings manager (8.2), so until it exists they open that list.
function ownerLinks(me: User, id: string) {
  const dealer = me.role === "dealership"
  const list = dealer ? "/dealer/inventory" : "/account/listings"
  return { edit: dealer ? `${list}/${id}/edit` : `/post?edit=${id}`, list }
}

// Replaces the contact buttons for the person who owns the listing. The status select works now: it saves at once and rolls back on failure.
export function OwnerPanel({ listing, me }: { listing: Listing; me: User }) {
  const { t, locale } = useT()
  const { mutate } = useSetListingStatus()
  const links = ownerLinks(me, listing.id)
  const live = listing.moderation === "approved"
  const closed = listing.intent === "rent" ? "rented" : "sold"
  const stats = [
    ["listing.stat_views", listing.stats.views],
    ["listing.stat_favorites", listing.stats.favorites],
    ["listing.stat_phone", listing.stats.phoneClicks],
    ["listing.stat_whatsapp", listing.stats.whatsappClicks],
  ] as const
  const change = (status: ListingStatus) =>
    mutate(
      { id: listing.id, status },
      {
        onSuccess: () => toast.add({ title: t("toast.status_updated") }),
        onError: () =>
          toast.add({
            title: t("toast.error_save"),
            actionProps: {
              children: t("common.retry"),
              onClick: () => change(status),
            },
          }),
      }
    )
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-4 md:p-5">
      <h2 className="text-title font-semibold">{t("listing.owner_title")}</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {stats.map(([key, value]) => (
          <div key={key} className="flex flex-col gap-0.5">
            <dt className="text-caption text-muted-foreground">{t(key)}</dt>
            <dd className="text-title font-semibold num">
              {formatNumber(value, locale)}
            </dd>
          </div>
        ))}
      </dl>
      {live && (
        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-muted-foreground">
            {t("listing.owner_status")}
          </span>
          <SelectInput
            aria-label={t("listing.owner_status")}
            value={listing.status}
            onChange={(status) => status && change(status as ListingStatus)}
            options={(["available", "reserved", closed] as const).map((s) => ({
              value: s,
              label: t(`status.${s}`),
            }))}
          />
        </div>
      )}
      <div className="flex flex-col gap-3">
        <a
          href={localeHref(links.edit, locale)}
          className={buttonVariants({ className: "w-full" })}
        >
          {t("common.edit")}
        </a>
        {live ? (
          <a
            href={localeHref(links.list, locale)}
            className={buttonVariants({
              variant: "signal",
              className: "w-full",
            })}
          >
            {t("listing.owner_promote")}
          </a>
        ) : (
          <p className="text-ui text-muted-foreground">
            {t("listing.promote_after_approval")}
          </p>
        )}
        <a
          href={localeHref(links.list, locale)}
          className={buttonVariants({
            variant: "secondary",
            className: "w-full",
          })}
        >
          {t("listing.owner_analytics")}
        </a>
      </div>
    </section>
  )
}
