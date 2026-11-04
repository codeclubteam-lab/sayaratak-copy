import { useT } from "@/lib/i18n/use-t"
import type { TargetType } from "@sayaratak/shared/schemas/review"
import { requiredDocuments } from "../schemas"

// What this kind of business has to send, so nobody guesses before opening the form.
export function RequirementsList({ targetType }: { targetType: TargetType }) {
  const { t } = useT()
  return (
    <section
      aria-labelledby="verification-requirements"
      className="flex flex-col gap-2"
    >
      <h2 id="verification-requirements" className="text-title font-semibold">
        {t("verification.requirements_title")}
      </h2>
      <ul className="ms-5 list-disc text-body">
        {requiredDocuments[targetType].map((label) => (
          <li key={label}>{t(`verification.${label}_label`)}</li>
        ))}
      </ul>
      <p className="text-ui text-muted-foreground">
        {t("verification.requirements_hint")}
      </p>
    </section>
  )
}
