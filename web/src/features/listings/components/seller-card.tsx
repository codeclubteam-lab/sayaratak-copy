import { formatMonthYear, initials } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { ContactActions } from "@/components/app/contact-actions"
import { VerifiedBadge } from "@/components/app/verified-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { sellerHref } from "../links"

// Who sells it and how to reach them. Below lg the contact buttons live in the fixed bar, so only the identity shows here.
export function SellerCard({
  listing,
  title,
  contact,
}: {
  listing: Listing
  title: string
  contact: boolean
}) {
  const { t, locale } = useT()
  const { owner } = listing
  const name = owner.name[locale]
  const business = owner.type === "dealership"
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-4 md:p-5">
      <h2 className="sr-only">{t("listing.seller_title")}</h2>
      <div className="flex items-center gap-3">
        <Avatar className={business ? "size-12 rounded-lg" : "size-12"}>
          {owner.avatarUrl && (
            <AvatarImage
              src={owner.avatarUrl}
              alt=""
              className={business ? "rounded-lg object-contain" : undefined}
            />
          )}
          <AvatarFallback
            className={`bg-accent text-[length:var(--text-ui)] font-semibold text-accent-foreground ${business ? "rounded-lg" : ""}`}
          >
            <bdi>{initials(name)}</bdi>
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-body font-semibold">
            <bdi>{name}</bdi>
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
            {owner.verified && <VerifiedBadge />}
            <span>
              {business ? t("common.dealership") : t("listing.seller_private")}
            </span>
          </p>
          <p className="text-caption text-muted-foreground">
            {t("listing.member_since", {
              date: formatMonthYear(owner.memberSince, locale),
            })}
          </p>
        </div>
      </div>
      {contact && (
        <ContactActions
          target={{ type: "listing", id: listing.id, title }}
          phone={listing.contact.phone}
          whatsapp={listing.contact.whatsapp}
          showPhone={listing.contact.showPhone}
          methods={listing.contact.methods}
        />
      )}
      <a
        href={localeHref(sellerHref(listing), locale)}
        className="inline-flex min-h-11 items-center text-ui font-medium text-primary hover:underline md:min-h-0"
      >
        {owner.profileSlug
          ? t("listing.seller_profile")
          : t("listing.seller_all")}
      </a>
    </section>
  )
}
