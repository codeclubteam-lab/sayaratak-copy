import { Suspense, useEffect, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter, useRouterState } from "@tanstack/react-router"
import { FormProvider, type FieldValues } from "react-hook-form"
import { z } from "zod"

import { AuthShell } from "@/components/app/auth-shell"
import { StepHeader } from "@/components/app/step-header"
import { StepIndicator } from "@/components/app/step-indicator"
import { StickyFooter } from "@/components/app/sticky-footer"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { withRedirect } from "@/features/auth/destination"
import { billingQueries } from "@/features/billing/queries"
import {
  draftQuery,
  saveDraftOnExit,
  useSaveDraft,
} from "@/features/auth/queries"
import { meQuery } from "@/features/auth/me-query"
import { useEnterKeyHints } from "@/hooks/use-enter-key-hints"
import { MOBILE_BREAKPOINT } from "@/hooks/use-mobile"
import { focusFirstInvalid } from "@/lib/focus-invalid"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath, localeHref } from "@/lib/navigation"
import { useCompleteOnboarding } from "../queries"
import { flatValues, stepValues, type DraftData } from "../draft"
import { flows, type FlowStep } from "../flows"
import { onboardingDraftKey, type OnboardingRole } from "../schemas"
import { OnboardingLayout } from "./onboarding-layout"
import { PreviewSheetButton } from "./preview-sheet-button"
import { StepPreview } from "./step-preview"
import { useAppForm } from "@/hooks/use-app-form"

const noSchema = z.object({})

// One page for every step of a flow. `steps` is a prop only so tests can run a small flow.
export function OnboardingStepPage({
  role,
  stepId,
  steps = flows[role],
  redirect,
}: {
  role: OnboardingRole
  stepId: string
  steps?: FlowStep[]
  // Where to land after the last step instead of the dashboard (set when sign in sent a new account here).
  redirect?: string
}) {
  const { t, locale } = useT()
  const router = useRouter()
  const key = onboardingDraftKey(role)
  const data = useQuery(draftQuery(key)).data?.data ?? {}
  const me = useQuery(meQuery).data
  const queryClient = useQueryClient()
  const save = useSaveDraft(key)
  const complete = useCompleteOnboarding()
  const index = steps.findIndex((s) => s.id === stepId)
  const step = steps[index]
  const next = steps[index + 1]
  const form = useAppForm<FieldValues>({
    resolver: zodResolver(step?.schema ?? noSchema),
    values: { ...(me && step?.defaults?.(me)), ...stepValues(data, stepId) },
  })
  const formRef = useRef<HTMLFormElement>(null)
  useEnterKeyHints(formRef, next ? "next" : "done")
  // The save lasts until the next step has loaded, so the button does not look idle in between.
  const navigating = useRouterState({ select: (s) => s.status === "pending" })
  // Desktop only, and only when the step opens fresh; a step change moves focus to the heading instead (StepHeader).
  useEffect(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) return
    formRef.current
      ?.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select")
      ?.focus()
  }, [])
  // Refresh, closing the tab or switching language reloads the page; what was typed since the last save goes to the draft first.
  // `touched` is a DOM flag, not form state: subscribing to isDirty made RHF drop the preselected plan.
  useEffect(() => {
    const el = formRef.current
    if (!el || !step) return
    let touched = false
    const touch = () => (touched = true)
    const flush = () =>
      touched && saveDraftOnExit(key, { ...data, [step.id]: form.getValues() })
    const onHide = () => document.visibilityState === "hidden" && flush()
    el.addEventListener("input", touch)
    el.addEventListener("click", touch)
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", flush)
    return () => {
      el.removeEventListener("input", touch)
      el.removeEventListener("click", touch)
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", flush)
    }
  }, [key, data, step, form])
  // The router keeps the page mounted between steps, so it does not scroll by itself.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [stepId])
  // `values` reach the form in an effect, so for one render a new step would still see the old step's values. Fields mount once that effect has run.
  const [loaded, setLoaded] = useState(stepId)
  useEffect(() => setLoaded(stepId), [stepId])
  if (!step) return null

  const prev = steps[index - 1]
  const go = (path: string) => router.history.push(localeHref(path, locale))
  const goStep = (path: string) => go(withRedirect(path, redirect))
  // A paid plan picked here goes straight to its checkout; the account stays on the free plan until the receipt is approved. The plan step has loaded the plans.
  const finish = (all: DraftData) => {
    const payload = flatValues(steps, all)
    const paid = queryClient
      .getQueryData(billingQueries.plans(role).queryKey)
      ?.find((p) => p.id === payload.planId && p.price > 0)
    const landing = paid
      ? `${dashboardPath(role)}/billing/checkout?${new URLSearchParams({ item: `plan:${paid.id}` })}`
      : (redirect ?? `${dashboardPath(role)}?welcome=1`)
    complete.mutate({ role, payload }, { onSuccess: () => go(landing) })
  }
  const advance = (all: DraftData) =>
    next ? goStep(`/onboarding/${role}/${next.id}`) : finish(all)
  const draftWith = (values: FieldValues) => ({ ...data, [step.id]: values })
  // Back and Save and exit leave at once; the save carries on in the background.
  const back = () => {
    save.mutate(draftWith(form.getValues()))
    goStep(prev ? `/onboarding/${role}/${prev.id}` : "/onboarding/role")
  }
  const exit = () => {
    if (step.schema.safeParse(form.getValues()).success)
      save.mutate(draftWith(form.getValues()))
    go("/")
  }
  const submit = form.handleSubmit(
    (values) =>
      save.mutate(draftWith(values), {
        onSuccess: (saved) => advance(saved.data),
      }),
    () => focusFirstInvalid(formRef.current)
  )
  const preview =
    role === "user" || step.wide ? null : (
      <StepPreview role={role} steps={steps} stepId={step.id} data={data} />
    )

  // The role page was step 1, so every flow counts it.
  const progress = { current: index + 2, total: steps.length + 1 }
  const skip = (
    <>
      {preview && <PreviewSheetButton>{preview}</PreviewSheetButton>}
      {step.optional && (
        <Button type="button" variant="link" onClick={() => advance(data)}>
          {t("common.skip")}
        </Button>
      )}
    </>
  )
  const submitButton = (
    <SubmitButton
      size="lg"
      pending={save.isPending || complete.isPending || navigating}
    >
      {next ? t("common.continue") : t(`onboarding.finish_${role}`)}
    </SubmitButton>
  )
  const body = (
    <>
      <StepHeader
        title={t(step.titleKey)}
        helper={t(step.helperKey)}
        step={step.id}
      />
      <form
        ref={formRef}
        noValidate
        data-reserve-errors
        className="flex flex-col gap-4"
        onSubmit={submit}
      >
        <div
          key={step.id}
          className={`flex flex-col gap-4 transition-opacity duration-(--dur-fast) ease-(--ease-standard) starting:opacity-0 ${role === "user" ? "" : "min-h-80"}`}
        >
          {loaded === step.id && (
            <Suspense fallback={null}>
              <step.Component />
            </Suspense>
          )}
        </div>
        {(save.isError || complete.isError) && (
          <div className="flex flex-wrap items-center gap-x-3">
            <p role="alert" className="text-ui text-destructive">
              {t("onboarding.save_error")}
            </p>
            <Button type="button" variant="link" onClick={submit}>
              {t("common.retry")}
            </Button>
          </div>
        )}
        {role === "user" ? (
          <div className="flex items-center gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={back}>
              {t("common.back")}
            </Button>
            <div className="ms-auto flex items-center gap-3">
              {skip}
              {submitButton}
            </div>
          </div>
        ) : (
          <StickyFooter
            onBack={back}
            skip={skip}
            width={step.wide ? "max-w-236" : "max-w-130 lg:max-w-236 lg:pe-106"}
          >
            {submitButton}
          </StickyFooter>
        )}
      </form>
    </>
  )

  return (
    <FormProvider {...form}>
      {role === "user" ? (
        // The buyer's one step shares the sign up screen's header and form column, so signing up and onboarding read as one flow.
        <AuthShell
          carousel={false}
          action={
            <Button type="button" variant="ghost" onClick={exit}>
              {t("onboarding.save_exit")}
            </Button>
          }
        >
          <StepIndicator {...progress} labelFromMd />
          {body}
        </AuthShell>
      ) : (
        <OnboardingLayout
          progress={progress}
          preview={preview}
          wide={step.wide}
          onExit={exit}
        >
          {body}
        </OnboardingLayout>
      )}
    </FormProvider>
  )
}
