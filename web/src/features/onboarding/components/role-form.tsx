import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useRouter, useRouterState } from "@tanstack/react-router"
import { useId } from "react"
import { Controller } from "react-hook-form"

import { StepHeader } from "@/components/app/step-header"
import { StickyFooter } from "@/components/app/sticky-footer"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { FieldLegend, FieldSet } from "@/components/ui/field"
import { draftQuery, useSaveDraft } from "@/features/auth/queries"
import { useT } from "@/lib/i18n/use-t"
import { stepHref } from "../draft"
import { firstStepId, flows } from "../flows"
import { roleChoiceSchema, roleDraftKey, type RoleChoice } from "../schemas"
import { OnboardingLayout } from "./onboarding-layout"
import { RoleOption } from "./role-option"
import { useAppForm } from "@/hooks/use-app-form"

const options: { role: RoleChoice["role"]; photo: string }[] = [
  { role: "user", photo: "buyers" },
  { role: "dealership", photo: "dealerships" },
  { role: "workshop", photo: "workshops" },
  { role: "mechanic", photo: "mechanics" },
]

export function RoleForm({ redirect }: { redirect?: string }) {
  const { t, locale } = useT()
  const router = useRouter()
  const name = useId()
  const draft = useQuery(draftQuery(roleDraftKey))
  const save = useSaveDraft(roleDraftKey)
  // Coming back from step 1 keeps the saved choice; otherwise `user`. `values` also covers a draft that arrives after the first render.
  const saved = roleChoiceSchema.safeParse(draft.data?.data)
  const form = useAppForm<RoleChoice>({
    resolver: zodResolver(roleChoiceSchema),
    values: { role: saved.success ? saved.data.role : "user" },
  })
  // The button stays pending until the first step has loaded.
  const navigating = useRouterState({ select: (s) => s.status === "pending" })
  const submit = form.handleSubmit(({ role }) =>
    save.mutate(
      { role },
      {
        onSuccess: () =>
          router.history.push(
            stepHref(role, firstStepId(role), locale, redirect)
          ),
      }
    )
  )
  // Step 1 of the whole flow; the total follows the role picked so far.
  const total = flows[form.watch("role")].length + 1
  return (
    <OnboardingLayout progress={{ current: 1, total }} wide>
      <StepHeader title={t("onboarding.role_title")} step="role" />
      <form noValidate className="flex flex-col gap-4" onSubmit={submit}>
        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <FieldSet>
              <FieldLegend className="sr-only">
                {t("onboarding.role_title")}
              </FieldLegend>
              <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
                {options.map(({ role, photo }) => (
                  <RoleOption
                    key={role}
                    name={name}
                    photo={photo}
                    title={t(`onboarding.role_${role}_title`)}
                    description={t(`onboarding.role_${role}_desc`)}
                    checked={field.value === role}
                    onChange={() => field.onChange(role)}
                  />
                ))}
              </div>
            </FieldSet>
          )}
        />
        {save.isError && (
          <div className="flex flex-wrap items-center gap-x-3">
            <p role="alert" className="text-ui text-destructive">
              {t("onboarding.role_error")}
            </p>
            <Button type="button" variant="link" onClick={submit}>
              {t("common.retry")}
            </Button>
          </div>
        )}
        <StickyFooter width="max-w-236">
          <SubmitButton size="lg" pending={save.isPending || navigating}>
            {t("common.continue")}
          </SubmitButton>
        </StickyFooter>
      </form>
    </OnboardingLayout>
  )
}
