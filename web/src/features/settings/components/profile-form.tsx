import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"

import { AvatarUpload } from "@/components/app/avatar-upload"
import { CitySelect } from "@/components/app/city-select"
import { FieldMarks, FormField } from "@/components/app/form-field"
import { PhoneInput } from "@/components/app/phone-input"
import { SubmitButton } from "@/components/app/submit-button"
import { Input } from "@/components/ui/input"
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field"
import { useSendOtp, useUpdateProfile } from "@/features/auth/queries"
import { mediaFromUrl } from "@/features/onboarding/media"
import { useT } from "@/lib/i18n/use-t"
import type { User } from "@sayaratak/shared/schemas/user"
import {
  profileFormSchema,
  profileWithoutEmailFormSchema,
  type ProfileForm,
} from "../schemas"
import { VerifyContactDialog } from "./verify-contact-dialog"
import { useAppForm } from "@/hooks/use-app-form"

const valuesOf = (me: User): ProfileForm => ({
  fullName: me.fullName,
  email: me.email ?? "",
  phone: me.phone ?? "",
  cityId: me.cityId ?? "",
  avatarUrl: me.avatarUrl ?? "",
})

// Only a new email needs a code. Phones save without SMS and remain unverified.
export function ProfileForm({ me }: { me: User }) {
  const { t } = useT()
  const update = useUpdateProfile()
  const send = useSendOtp()
  const [saved, setSaved] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const form = useAppForm<ProfileForm>({
    resolver: zodResolver(
      me.email ? profileFormSchema : profileWithoutEmailFormSchema
    ),
    mode: "onTouched",
    defaultValues: valuesOf(me),
  })
  const done = (user: User) => {
    form.reset(valuesOf(user))
    setSaved(true)
  }
  const submit = form.handleSubmit(async (values) => {
    setSaved(false)
    const emailChanged = values.email && values.email !== me.email
    if (emailChanged) {
      const error = await send.mutateAsync({ identifier: values.email }).then(
        () => undefined,
        (e: { code?: string }) => e
      )
      if (error) {
        const message =
          error.code === "exists"
            ? "settings.contact_taken"
            : "auth.otp_send_error"
        return form.setError("email", { message }, { shouldFocus: true })
      }
    }
    update.mutate(
      {
        fullName: values.fullName,
        cityId: values.cityId,
        avatarUrl: values.avatarUrl,
        phone: values.phone,
      },
      {
        onSuccess: (user) => (emailChanged ? setWaiting(true) : done(user)),
        onError: (error) => {
          if (error.code === "exists")
            form.setError(
              "phone",
              { message: "settings.contact_taken" },
              { shouldFocus: true }
            )
        },
      }
    )
  })
  return (
    <>
      <FieldMarks value="required">
        <form
          onSubmit={submit}
          noValidate
          className="flex max-w-lg flex-col gap-4"
        >
          <Controller
            control={form.control}
            name="avatarUrl"
            render={({ field }) => (
              <AvatarUpload
                label={t("onboarding.user_avatar_label")}
                value={field.value ? mediaFromUrl(field.value) : null}
                onChange={(media) => field.onChange(media?.url ?? "")}
              />
            )}
          />
          <FormField
            label={t("auth.full_name_label")}
            error={form.formState.errors.fullName?.message}
          >
            {(c) => (
              <Input
                {...c}
                {...form.register("fullName")}
                autoComplete="name"
              />
            )}
          </FormField>
          <FieldSet>
            <FieldLegend variant="label">
              {t("settings.contact_legend")}
            </FieldLegend>
            <FieldDescription>{t("settings.contact_hint")}</FieldDescription>
            <FormField
              optional={!me.email}
              label={t("settings.email_label")}
              error={form.formState.errors.email?.message}
            >
              {(c) => (
                <Input
                  {...c}
                  {...form.register("email")}
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                />
              )}
            </FormField>
            <Controller
              control={form.control}
              name="phone"
              render={({ field, fieldState }) => (
                <FormField
                  optional
                  label={t("form.phone")}
                  error={fieldState.error?.message}
                >
                  {(c) => <PhoneInput {...c} {...field} />}
                </FormField>
              )}
            />
          </FieldSet>
          <Controller
            control={form.control}
            name="cityId"
            render={({ field, fieldState }) => (
              <CitySelect
                optional
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <p aria-hidden="true" className="text-caption text-muted-foreground">
            {t("form.required_note")}
          </p>
          {update.isError && (
            <p role="alert" className="text-ui text-destructive">
              {t("settings.save_error")}
            </p>
          )}
          <SubmitButton
            className="self-start"
            pending={update.isPending || send.isPending}
            dirty={form.formState.isDirty}
            savedLabel={saved}
          >
            {t("common.save")}
          </SubmitButton>
        </form>
      </FieldMarks>
      {waiting && (
        <VerifyContactDialog
          field="email"
          value={form.getValues("email")}
          sent
          onCancel={() => setWaiting(false)}
          onVerified={(user) => {
            setWaiting(false)
            done(user)
          }}
        />
      )}
    </>
  )
}
