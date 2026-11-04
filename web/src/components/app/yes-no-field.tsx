import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"
import { ChipSingleSelect } from "./chip-single-select"

// Yes, no, or not stated (null). Two chips and a "Clear" that appears once one is chosen, since a radio cannot be unchosen.
export function YesNoField({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: boolean | null
  onChange: (value: boolean | null) => void
  error?: string
}) {
  const { t } = useT()
  return (
    <ChipSingleSelect
      legend={label}
      options={[
        { value: "yes", label: t("form.yes") },
        { value: "no", label: t("form.no") },
      ]}
      value={value === null ? null : value ? "yes" : "no"}
      onChange={(v) => onChange(v === "yes")}
      error={error}
      action={
        value !== null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
          >
            {t("common.clear")}
          </Button>
        )
      }
    />
  )
}
