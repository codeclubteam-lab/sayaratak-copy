import { Controller, type UseFormReturn } from "react-hook-form"
import { Trash2Icon } from "lucide-react"

import { FormField } from "@/components/app/form-field"
import { ImageFileInput } from "@/components/app/image-file-input"
import { SelectInput, type SelectOption } from "@/components/app/select-input"
import { RemoveButton } from "@/components/app/remove-button"
import { useT } from "@/lib/i18n/use-t"
import type { VerificationForm } from "../schemas"

// One document: what it is, the file, and a button that drops the row (the last row stays).
export function DocumentRow({
  form,
  index,
  options,
  onRemove,
}: {
  form: UseFormReturn<VerificationForm>
  index: number
  options: SelectOption[]
  onRemove?: () => void
}) {
  const { t } = useT()
  const n = index + 1
  const errors = form.formState.errors.documents?.[index]
  return (
    <div
      role="group"
      data-slot="document-row"
      aria-label={t("verification.doc_n", { n })}
      className="flex flex-col gap-3 rounded-xl bg-card p-4"
    >
      <div className="flex items-end gap-2">
        <FormField
          className="flex-1"
          label={t("verification.doc_type")}
          error={errors?.label?.message}
        >
          {(control) => (
            <Controller
              control={form.control}
              name={`documents.${index}.label`}
              render={({ field }) => (
                <SelectInput
                  {...control}
                  value={field.value}
                  onChange={(next) => field.onChange(next)}
                  options={options}
                />
              )}
            />
          )}
        </FormField>
        {onRemove && (
          <RemoveButton
            variant="ghost"
            size="icon"
            aria-label={t("verification.doc_remove", { n })}
            title={t("verification.doc_remove_title", { n })}
            onConfirm={onRemove}
          >
            <Trash2Icon aria-hidden="true" />
          </RemoveButton>
        )}
      </div>
      <FormField
        label={t("verification.doc_file")}
        error={errors?.file?.message}
      >
        {(control) => (
          <ImageFileInput
            value={form.watch(`documents.${index}.file`)}
            control={control}
            labels={{
              choose: t("verification.doc_choose"),
              preview: t("verification.doc_preview"),
              remove: t("verification.doc_remove_file", { n }),
            }}
            onChange={(file) =>
              form.setValue(`documents.${index}.file`, file as File, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
          />
        )}
      </FormField>
    </div>
  )
}
