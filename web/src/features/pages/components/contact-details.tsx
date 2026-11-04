import { useQuery } from "@tanstack/react-query"
import { MailIcon, MapPinIcon, PhoneIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { toWhatsappUrl } from "@sayaratak/shared/lib/phone"
import { BrandIcon } from "@/components/app/brand-icon"
import { SectionError } from "@/components/app/section-error"
import { siteQuery } from "../queries"

const link =
  "inline-flex min-h-11 items-center gap-3 rounded-lg hover:text-primary"

// Phone, WhatsApp and email are links; the address is plain text (`GET /site`).
export function ContactDetails() {
  const { t } = useT()
  const { data, isError, refetch } = useQuery(siteQuery)
  if (isError)
    return (
      <SectionError
        title={t("pages.contact_details")}
        message={t("nav.contact_error")}
        onRetry={() => void refetch()}
      />
    )
  const contact = data?.contact
  if (!contact) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-title font-semibold">{t("pages.contact_details")}</h2>
      <address className="flex flex-col items-start text-body not-italic">
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className={link}>
            <PhoneIcon aria-hidden="true" className="size-5" />
            <bdi>{contact.phone}</bdi>
          </a>
        )}
        {contact.whatsapp && (
          <a href={toWhatsappUrl(contact.whatsapp)} className={link}>
            <BrandIcon name="whatsapp" className="size-5" />
            {t("nav.whatsapp")}
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`} className={link}>
            <MailIcon aria-hidden="true" className="size-5" />
            <bdi>{contact.email}</bdi>
          </a>
        )}
        {contact.address && (
          <span className="inline-flex min-h-11 items-center gap-3">
            <MapPinIcon aria-hidden="true" className="size-5" />
            <span dir="auto">{contact.address}</span>
          </span>
        )}
      </address>
    </section>
  )
}
