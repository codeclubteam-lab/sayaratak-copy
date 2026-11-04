import { useEffect, useRef } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"

import { normalizeIdentifier } from "@/features/auth/identifier"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { contactSubjects } from "@sayaratak/shared/schemas/inputs"
import { FormField } from "@/components/app/form-field"
import { SelectInput } from "@/components/app/select-input"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useSendContact } from "../queries"
import { contactFormSchema, type ContactForm as Values } from "../schemas"
import { useAppForm } from "@/hooks/use-app-form"

const empty: Values = {
  name: "",
  contact: "",
  subject: "general",
  message: "",
}

// A sent message swaps the form for a thank-you with a "Send another" button.
export function ContactForm() {
  const { t } = useT()
  const send = useSendContact()
  const sent = useRef<HTMLHeadingElement>(null)
  const form = useAppForm<Values>({
    resolver: zodResolver(contactFormSchema),
    mode: "onTouched",
    defaultValues: empty,
  })
  const { errors } = form.formState
  useEffect(() => {
    if (send.isSuccess) sent.current?.focus()
  }, [send.isSuccess])
  const submit = form.handleSubmit((values) =>
    send.mutate(
      { ...values, contact: normalizeIdentifier(values.contact) },
      { onError: (error) => toast.add({ title: errorText(t, error) }) }
    )
  )
  if (send.isSuccess)
    return (
      <section className="flex flex-col items-start gap-3">
        <h2
          ref={sent}
          tabIndex={-1}
          className="text-title font-semibold outline-none"
        >
          {t("pages.contact_sent_title")}
        </h2>
        <p role="status" className="text-body text-muted-foreground">
          {t("pages.contact_sent_body")}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            send.reset()
            form.reset(empty)
          }}
        >
          {t("pages.contact_send_another")}
        </Button>
      </section>
    )
  return (
    <section className="flex max-w-xl flex-col gap-4">
      <h2 className="text-title font-semibold">
        {t("pages.contact_form_title")}
      </h2>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormField label={t("pages.contact_name")} error={errors.name?.message}>
          {(control) => (
            <Input
              {...control}
              autoComplete="name"
              maxLength={80}
              {...form.register("name")}
            />
          )}
        </FormField>
        <FormField
          label={t("pages.contact_identifier")}
          description={t("pages.contact_identifier_hint")}
          error={errors.contact?.message}
        >
          {(control) => (
            <Input
              {...control}
              dir={form.watch("contact").trim() ? "ltr" : undefined}
              autoComplete="username"
              {...form.register("contact")}
            />
          )}
        </FormField>
        <FormField
          label={t("pages.contact_subject")}
          error={errors.subject?.message}
        >
          {(control) => (
            <Controller
              control={form.control}
              name="subject"
              render={({ field }) => (
                <SelectInput
                  {...control}
                  value={field.value}
                  onChange={field.onChange}
                  options={contactSubjects.map((value) => ({
                    value,
                    label: t(`pages.subject_${value}`),
                  }))}
                />
              )}
            />
          )}
        </FormField>
        <FormField
          label={t("pages.contact_message")}
          error={errors.message?.message}
        >
          {(control) => (
            <Textarea
              {...control}
              maxLength={1000}
              {...form.register("message")}
            />
          )}
        </FormField>
        <SubmitButton pending={send.isPending} className="self-start">
          {t("pages.contact_send")}
        </SubmitButton>
      </form>
    </section>
  )
}
