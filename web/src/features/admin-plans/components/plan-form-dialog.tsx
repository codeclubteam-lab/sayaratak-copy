import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"

import { errorText } from "@/lib/api/error-text"
import { focusFirstInvalid } from "@/lib/focus-invalid"
import { useT } from "@/lib/i18n/use-t"
import type { AdminPlan } from "@sayaratak/shared/schemas/admin"
import { useCreatePlan, useUpdatePlan } from "@/features/admin/queries"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useAppForm } from "@/hooks/use-app-form"
import { planFormSchema, type PlanForm } from "../schemas"
import { PlanFormFields } from "./plan-form-fields"
import { capsOf } from "./plan-caps"

const valuesOf = (
  audience: AdminPlan["audience"],
  plan: AdminPlan | undefined,
  nextOrder: number
): PlanForm => ({
  audience,
  nameAr: plan?.name.ar ?? "",
  nameEn: plan?.name.en ?? "",
  price: plan ? plan.price : null,
  durationDays: plan?.durationDays ?? 30,
  listingLimit: plan?.listingLimit ?? null,
  featuredCredits: plan?.featuredCredits ?? 0,
  serviceLimit: plan?.serviceLimit ?? null,
  photoLimit: plan?.photoLimit ?? null,
  portfolioLimit: plan?.portfolioLimit ?? null,
  features: plan?.features ?? [],
  enabled: plan?.enabled ?? true,
  sortOrder: plan?.sortOrder ?? nextOrder,
})

// The wire body: caps this audience does not use are sent empty, so the plan never keeps a stray one.
function toInput(v: PlanForm) {
  const caps = capsOf[v.audience]
  const cap = (key: (typeof caps)[number]) =>
    caps.includes(key) ? v[key] : null
  return {
    audience: v.audience,
    name: { ar: v.nameAr, en: v.nameEn },
    price: v.price ?? 0,
    durationDays: v.durationDays,
    listingLimit: cap("listingLimit"),
    serviceLimit: cap("serviceLimit"),
    photoLimit: cap("photoLimit"),
    portfolioLimit: cap("portfolioLimit"),
    featuredCredits: cap("featuredCredits") ?? 0,
    features: v.features,
    enabled: v.enabled,
    sortOrder: v.sortOrder,
  }
}

// Add or edit one plan of an audience. Saving closes the dialog; the plan shows in onboarding and billing at once when on.
export function PlanFormDialog({
  open,
  onOpenChange,
  audience,
  plan,
  nextOrder,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  audience: AdminPlan["audience"]
  plan?: AdminPlan
  nextOrder: number
}) {
  const { t, locale } = useT()
  const create = useCreatePlan()
  const update = useUpdatePlan()
  const form = useAppForm<PlanForm>({
    resolver: zodResolver(planFormSchema),
    mode: "onTouched",
    defaultValues: valuesOf(audience, plan, nextOrder),
  })
  useEffect(() => {
    if (open) form.reset(valuesOf(audience, plan, nextOrder))
  }, [open, audience, plan, nextOrder, form])
  const done = (key: string) => ({
    onSuccess: () => {
      toast.add({ title: t(key) })
      onOpenChange(false)
    },
    onError: (e: unknown) => toast.add({ title: errorText(t, e) }),
  })
  const submit = form.handleSubmit(
    (values) => {
      // The audience is fixed once a plan exists.
      const { audience: forAudience, ...body } = toInput(values)
      if (plan)
        update.mutate({ id: plan.id, ...body }, done("admin.plan_saved_toast"))
      else
        create.mutate(
          { audience: forAudience, ...body },
          done("admin.plan_saved_toast")
        )
    },
    () => focusFirstInvalid(document.querySelector("[data-plan-form]"))
  )
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={
        plan
          ? t("admin.plan_edit_title", { name: plan.name[locale] })
          : t(`admin.plan_add_title_${audience}`)
      }
    >
      <form
        noValidate
        data-plan-form
        className="flex flex-col gap-6"
        onSubmit={submit}
      >
        <PlanFormFields form={form} plan={plan} />
        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={create.isPending || update.isPending}>
            {t("admin.plan_save")}
          </SubmitButton>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  )
}
