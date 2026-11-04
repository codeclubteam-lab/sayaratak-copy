import { useEffect, useRef, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "@tanstack/react-router"
import { FormProvider, type FieldValues } from "react-hook-form"
import { z } from "zod"

import { FieldMarks } from "@/components/app/form-field"
import { StepHeader } from "@/components/app/step-header"
import { StickyFooter } from "@/components/app/sticky-footer"
import { SubmitButton } from "@/components/app/submit-button"
import { toast } from "@/components/ui/toast"
import { useEnterKeyHints } from "@/hooks/use-enter-key-hints"
import { focusFirstInvalid } from "@/lib/focus-invalid"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { useStepHref } from "./use-step-href"
import { useWizardDraft, type WizardBase } from "./use-wizard-draft"
import { WizardLayout } from "./wizard-layout"
import {
  firstInvalidIndex,
  wizardDraftKey,
  type WizardStep,
} from "./wizard-config"
import { useAppForm } from "@/hooks/use-app-form"

const noRules = z.object({})

// The shell of the post wizard: one form for every step, the rules of the current step only, drafts, step jumps and the footer. The steps themselves come in `steps`. The route passes `stepId` from its `step` search param.
export function ListingWizard({
  context,
  stepId,
  steps,
  editId,
  base,
  defaultValues = {},
  publishDisabled = false,
  banner,
  onPublish,
}: {
  context: "public" | "dealer"
  stepId: string
  steps: WizardStep[]
  editId?: string
  // The listing being edited as form values. Leave it out for a new listing; while an edit loads, `editId` is set and `base` is not.
  base?: WizardBase
  defaultValues?: FieldValues
  // Publish stays off, for example while the free limit is used up.
  publishDisabled?: boolean
  // A notice above the step, for example why the listing being edited was rejected.
  banner?: ReactNode
  // Runs on Publish after the last step is valid. It shows its own errors, and resolves `true` once the listing is saved: the wizard then drops its draft.
  onPublish: (values: FieldValues) => Promise<unknown>
}) {
  const { t, locale } = useT()
  const router = useRouter()
  const href = useStepHref()
  const index = steps.findIndex((s) => s.id === stepId)
  const step = steps[index]
  const form = useAppForm<FieldValues>({
    defaultValues,
    resolver: (values, ctx, options) =>
      zodResolver(step?.schema?.(values) ?? noRules)(values, ctx, options),
  })
  const { restored, saveNow, clear } = useWizardDraft({
    form,
    draftKey: wizardDraftKey(editId),
    base: editId && !base ? undefined : (base ?? null),
  })
  const formRef = useRef<HTMLFormElement>(null)
  const last = index === steps.length - 1
  useEnterKeyHints(formRef, last ? "done" : "next")

  // A step opens only when every earlier step is valid; otherwise the first invalid one opens.
  const reachable = restored ? firstInvalidIndex(steps, form.getValues()) : 0
  useEffect(() => {
    const target = steps[reachable]
    if (restored && index > reachable && target)
      router.history.replace(href(target.id))
  }, [restored, index, reachable])
  // The router keeps the page mounted between steps, so it does not scroll by itself.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [stepId])
  if (!step) return null

  const go = (id: string) => {
    saveNow()
    router.history.push(href(id))
  }
  const leave = () => {
    saveNow()
    router.history.push(
      localeHref(context === "dealer" ? "/dealer/inventory" : "/", locale)
    )
  }
  const prev = steps[index - 1]
  const next = steps[index + 1]
  const submit = form.handleSubmit(
    async () => {
      if (next) return go(next.id)
      if ((await onPublish(form.getValues())) === true) clear()
    },
    () => focusFirstInvalid(formRef.current)
  )

  return (
    <FormProvider {...form}>
      <FieldMarks value="required">
        <WizardLayout
          context={context}
          editing={!!editId}
          onExit={() => {
            leave()
            toast.add({ title: t("toast.draft_saved") })
          }}
          indicator={{
            steps: steps.map((s) => ({ id: s.id, label: t(s.labelKey) })),
            current: index,
            reachable,
            href,
          }}
        >
          {banner}
          <StepHeader
            title={t(step.titleKey)}
            helper={step.helperKey && t(step.helperKey)}
            step={step.id}
          />
          <form
            ref={formRef}
            noValidate
            className="flex flex-col gap-4"
            onSubmit={submit}
          >
            <div
              key={step.id}
              aria-busy={!restored}
              className="flex min-h-80 flex-col gap-4 transition-opacity duration-(--dur-fast) ease-(--ease-standard) starting:opacity-0"
            >
              {restored && <step.Component editing={!!editId} />}
            </div>
            <StickyFooter
              width="max-w-152 lg:max-w-212"
              onBack={() => (prev ? go(prev.id) : leave())}
            >
              <SubmitButton
                size="lg"
                pending={form.formState.isSubmitting}
                disabled={last && publishDisabled}
              >
                {last ? t("post.publish") : t("common.next")}
              </SubmitButton>
            </StickyFooter>
          </form>
        </WizardLayout>
      </FieldMarks>
    </FormProvider>
  )
}
