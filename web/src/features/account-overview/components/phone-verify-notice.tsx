import { useState } from "react"

import { Button } from "@/components/ui/button"
import { VerifyContactDialog } from "@/features/settings/components/verify-contact-dialog"
import { useT } from "@/lib/i18n/use-t"

// An unverified phone, when codes are on. The dialog sends the code and, on the right one, marks the phone verified; `/me` updates and the notice goes.
export function PhoneVerifyNotice({ phone }: { phone: string }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  return (
    <section className="flex flex-col items-start gap-3 rounded-xl bg-accent p-4 text-accent-foreground">
      <h2 className="text-body font-semibold">
        {t("dashboard.overview_phone_title")}
      </h2>
      <p className="text-ui">
        {t("dashboard.overview_phone_body", {
          phone: `⁦${phone}⁩`,
        })}
      </p>
      <Button type="button" onClick={() => setOpen(true)}>
        {t("dashboard.overview_phone_cta")}
      </Button>
      {open && (
        <VerifyContactDialog
          existing
          field="phone"
          value={phone}
          onCancel={() => setOpen(false)}
          onVerified={() => setOpen(false)}
        />
      )}
    </section>
  )
}
