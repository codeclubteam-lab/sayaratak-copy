import { useT } from "@/lib/i18n/use-t"
import type { Settings } from "@sayaratak/shared/schemas/admin"
import { FormField } from "@/components/app/form-field"
import { Input } from "@/components/ui/input"
import { paymentSettingsSchema } from "../schemas"
import { SettingsCard } from "./settings-card"

export function PaymentSettings({ settings }: { settings: Settings }) {
  const { t } = useT()
  return (
    <SettingsCard
      title={t("admin.settings_payments")}
      description={t("admin.settings_payments_hint")}
      schema={paymentSettingsSchema}
      values={{
        bankakAccountName: settings.bankakAccount.name,
        bankakAccountNumber: settings.bankakAccount.number,
      }}
      toBody={(v) => ({
        bankakAccount: {
          name: v.bankakAccountName,
          number: v.bankakAccountNumber,
        },
      })}
    >
      {({ register, formState: { errors } }) => (
        <>
          <FormField
            label={t("billing.account_name")}
            error={errors.bankakAccountName?.message}
          >
            {(props) => (
              <Input
                {...props}
                maxLength={80}
                {...register("bankakAccountName")}
              />
            )}
          </FormField>
          <FormField
            label={t("billing.account_number")}
            error={errors.bankakAccountNumber?.message}
          >
            {(props) => (
              <Input
                {...props}
                dir="ltr"
                inputMode="numeric"
                maxLength={20}
                {...register("bankakAccountNumber")}
              />
            )}
          </FormField>
        </>
      )}
    </SettingsCard>
  )
}
