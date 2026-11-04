import { useState } from "react"
import { PhoneIcon } from "lucide-react"

import { useTrackEvent } from "@/features/listings/events"
import { useT } from "@/lib/i18n/use-t"
import { formatPhone, toWhatsappUrl } from "@sayaratak/shared/lib/phone"
import { usePageUrl } from "@/lib/use-page-url"
import { cn } from "@/lib/utils"
import { buttonVariants, Button } from "@/components/ui/button"
import { BrandIcon } from "./brand-icon"
import { MessageComposer, type MessageSubject } from "./message-composer"

type Method = "call" | "whatsapp" | "chat"

// Call shows the number on the first tap and dials on the second. Buttons the seller turned off are not rendered.
export function ContactActions({
  target,
  phone,
  whatsapp,
  showPhone = true,
  methods = ["call", "whatsapp", "chat"],
  layout = "stack",
  className,
}: {
  target: MessageSubject
  phone: string
  whatsapp: string | null
  showPhone?: boolean
  methods?: Method[]
  layout?: "stack" | "row" | "bar"
  className?: string
}) {
  const { t } = useT()
  const url = usePageUrl()
  const [revealed, setRevealed] = useState(false)
  const { mutate: track } = useTrackEvent()
  // "bar" is the fixed mobile bar: three equal buttons with the icon above a caption-size label.
  const item =
    layout === "stack"
      ? "w-full"
      : layout === "row"
        ? "flex-1"
        : "h-12 min-w-0 flex-1 flex-col gap-0.5 px-1 text-[length:var(--text-caption)] has-data-[icon=inline-start]:ps-1 md:h-12 [&_svg:not([class*='size-'])]:size-5"
  const text = t(
    target.type === "listing"
      ? "listing.whatsapp_text"
      : "listing.whatsapp_text_profile",
    { title: target.title, url }
  )
  return (
    <div
      className={cn(
        layout === "stack" ? "flex flex-col gap-3" : "flex gap-2",
        className
      )}
    >
      {methods.includes("call") &&
        showPhone &&
        (revealed ? (
          <a
            href={`tel:${phone}`}
            autoFocus
            aria-label={t("listing.call_number", { phone: formatPhone(phone) })}
            className={cn(
              buttonVariants(),
              item,
              layout === "bar" && "flex-[2]"
            )}
          >
            <PhoneIcon aria-hidden="true" strokeWidth={1.5} />
            <bdi dir="ltr">{formatPhone(phone)}</bdi>
          </a>
        ) : (
          <Button
            type="button"
            className={item}
            onClick={() => {
              setRevealed(true)
              track({ type: "phone_click", targetId: target.id })
            }}
          >
            <PhoneIcon aria-hidden="true" strokeWidth={1.5} />
            {t("listing.call")}
          </Button>
        ))}
      {methods.includes("whatsapp") && whatsapp && (
        <a
          href={toWhatsappUrl(whatsapp, text)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track({ type: "whatsapp_click", targetId: target.id })}
          className={cn(buttonVariants({ variant: "outline" }), item)}
        >
          <BrandIcon name="whatsapp" />
          {t("listing.whatsapp")}
        </a>
      )}
      {methods.includes("chat") && (
        <MessageComposer subject={target} className={item} />
      )}
    </div>
  )
}
