import { useId } from "react"

import { useT } from "@/lib/i18n/use-t"
import type { Checkout } from "@sayaratak/shared/schemas/responses"
import { AccountDetails } from "./account-details"
import { CopyRow } from "./copy-row"

const steps = ["transfer", "reference", "receipt"] as const

// The Bankak steps (a real sequence, so an ordered list), the account and the reference code to write in the note.
export function TransferInstructions({ checkout }: { checkout: Checkout }) {
  const { t } = useT()
  const heading = useId()
  return (
    <section aria-labelledby={heading} className="flex flex-col gap-4">
      <h2 id={heading} className="text-title font-semibold">
        {t("billing.transfer_title")}
      </h2>
      <ol className="flex list-decimal flex-col gap-1 ps-5 text-body">
        {steps.map((step) => (
          <li key={step}>{t(`billing.step_${step}`)}</li>
        ))}
      </ol>
      <dl className="flex flex-col gap-3 rounded-xl bg-card p-4">
        <AccountDetails
          name={checkout.bankak.name}
          number={checkout.bankak.number}
        />
        <CopyRow
          label={t("billing.reference_code")}
          value={checkout.reference}
          copyLabel={t("billing.copy_reference")}
        />
      </dl>
    </section>
  )
}
