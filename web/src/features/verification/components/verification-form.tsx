import { useRef } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { useFieldArray } from "react-hook-form"

import { FormField } from "@/components/app/form-field"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { errorText } from "@/lib/api/error-text"
import { keys } from "@/lib/api/query-keys"
import { focusFirstInvalid } from "@/lib/focus-invalid"
import { useT } from "@/lib/i18n/use-t"
import type { TargetType } from "@sayaratak/shared/schemas/review"
import { useRequestVerification } from "../queries"
import {
  MAX_DOCUMENTS,
  requiredDocuments,
  verificationFormSchema,
  type VerificationForm as Values,
} from "../schemas"
import { verificationStatusId } from "./status-card"
import { DocumentRow } from "./document-row"
import { useAppForm } from "@/hooks/use-app-form"

// One row per required document to start, up to five. Sending saves a pending request; the status card above then reads "Under review".
export function VerificationForm({ targetType }: { targetType: TargetType }) {
  const { t } = useT()
  const qc = useQueryClient()
  const send = useRequestVerification()
  const formRef = useRef<HTMLFormElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const required = requiredDocuments[targetType]
  const options = [...required, "other" as const].map((value) => ({
    value,
    label: t(`verification.${value}_label`),
  }))
  const form = useAppForm<Values>({
    resolver: zodResolver(verificationFormSchema),
    mode: "onTouched",
    defaultValues: {
      documents: required.map((label) => ({ label })),
      note: "",
    },
  })
  const rows = useFieldArray({ control: form.control, name: "documents" })
  const add = () => {
    const used = form.getValues("documents").map((d) => d.label)
    rows.append({
      label: required.find((l) => !used.includes(l)) ?? "other",
    } as Values["documents"][number])
    // The new row's first control takes focus once it is on the page.
    requestAnimationFrame(() =>
      [...(formRef.current?.querySelectorAll("[data-slot=document-row]") ?? [])]
        .at(rows.fields.length)
        ?.querySelector("button")
        ?.focus()
    )
  }
  const submit = form.handleSubmit(
    (values) =>
      send.mutate(values, {
        onSuccess: () => document.getElementById(verificationStatusId)?.focus(),
        onError: (error) => {
          toast.add({ title: errorText(t, error) })
          // Another tab may have sent it already: reload the status.
          void qc.invalidateQueries({ queryKey: keys.verification })
        },
      }),
    () => focusFirstInvalid(formRef.current)
  )
  return (
    <form
      ref={formRef}
      noValidate
      aria-label={t("verification.form_label")}
      onSubmit={submit}
      className="flex flex-col gap-4"
    >
      {rows.fields.map((field, index) => (
        <DocumentRow
          key={field.id}
          form={form}
          index={index}
          options={options}
          onRemove={
            rows.fields.length > 1
              ? () => {
                  rows.remove(index)
                  requestAnimationFrame(() => addRef.current?.focus())
                }
              : undefined
          }
        />
      ))}
      {rows.fields.length < MAX_DOCUMENTS && (
        <Button
          ref={addRef}
          type="button"
          variant="outline"
          className="self-start"
          onClick={add}
        >
          <PlusIcon aria-hidden="true" />
          {t("verification.doc_add")}
        </Button>
      )}
      <FormField
        optional
        label={t("verification.note")}
        error={form.formState.errors.note?.message}
      >
        {(control) => (
          <Textarea {...control} maxLength={300} {...form.register("note")} />
        )}
      </FormField>
      <SubmitButton className="self-start" pending={send.isPending}>
        {t("verification.submit")}
      </SubmitButton>
    </form>
  )
}
