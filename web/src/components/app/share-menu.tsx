import { useSyncExternalStore } from "react"
import { LinkIcon, Share2Icon } from "lucide-react"

import { useTrackEvent } from "@/features/listings/events"
import { formatPrice } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { usePageUrl } from "@/lib/use-page-url"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/toast"

import { BrandIcon } from "./brand-icon"

const noop = () => () => {}
const canShare = () => typeof navigator.share === "function"

// Facebook, Telegram and WhatsApp take a share URL. TikTok has none, so it copies the link and tells the person what to do.
// The link is the short /listing/<id> form: the Arabic slug turns into %D8%.. in chat apps, and the loader redirects it to the canonical slug.
export function ShareMenu({
  listing,
  title,
  className,
}: {
  listing: Pick<Listing, "id" | "price" | "rentPeriod">
  title: string
  className?: string
}) {
  const { t, locale } = useT()
  const page = usePageUrl()
  const url =
    page && new URL(localeHref(`/listing/${listing.id}`, locale), page).href
  const { amount, unit } = formatPrice(listing.price, locale)
  const period = listing.rentPeriod
    ? ` ${t(`listing.per_${listing.rentPeriod}`)}`
    : ""
  const text = `${title} · ${amount} ${unit}${period}`
  const native = useSyncExternalStore(noop, canShare, () => false)
  const { mutate: track } = useTrackEvent()
  const enc = encodeURIComponent
  const links = [
    {
      key: "listing.whatsapp",
      icon: "whatsapp",
      href: `https://wa.me/?text=${enc(`${text}\n${url}`)}`,
    },
    {
      key: "listing.share_facebook",
      icon: "facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    },
    {
      key: "listing.share_telegram",
      icon: "telegram",
      href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`,
    },
  ] as const
  const done = () => track({ type: "share", targetId: listing.id })
  const copy = (message: string) => {
    void navigator.clipboard
      .writeText(url)
      .then(() => toast.add({ title: message }))
      .catch(() => toast.add({ title: t("toast.error_save") }))
    done()
  }
  const item = "min-h-11 md:min-h-10"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className={className} />}
      >
        <Share2Icon aria-hidden="true" strokeWidth={1.5} />
        {t("listing.share")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {native && (
          <DropdownMenuItem
            className={item}
            onClick={() => {
              void navigator.share({ title, text, url }).then(done, () => {})
            }}
          >
            <Share2Icon aria-hidden="true" strokeWidth={1.5} />
            {t("listing.share_more")}
          </DropdownMenuItem>
        )}
        {links.map((l) => (
          <DropdownMenuItem
            key={l.key}
            className={item}
            onClick={done}
            render={
              <a href={l.href} target="_blank" rel="noopener noreferrer" />
            }
          >
            <BrandIcon name={l.icon} />
            {t(l.key)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem
          className={item}
          onClick={() => copy(t("toast.tiktok_copied"))}
        >
          <BrandIcon name="tiktok" />
          {t("listing.share_tiktok")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={item}
          onClick={() => copy(t("toast.link_copied"))}
        >
          <LinkIcon aria-hidden="true" strokeWidth={1.5} />
          {t("listing.share_copy")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
