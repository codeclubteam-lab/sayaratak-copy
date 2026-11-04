import { useT } from "@/lib/i18n/use-t"
import { CopyRow } from "./copy-row"

// The Bankak account the money goes to, from the settings the checkout returns.
export function AccountDetails({
  name,
  number,
}: {
  name: string
  number: string
}) {
  const { t } = useT()
  return (
    <>
      <CopyRow
        label={t("billing.account_name")}
        value={name}
        copyLabel={t("billing.copy_account_name")}
      />
      <CopyRow
        label={t("billing.account_number")}
        value={number}
        copyLabel={t("billing.copy_account_number")}
      />
    </>
  )
}
