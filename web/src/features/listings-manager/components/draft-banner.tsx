import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { z } from "zod"

import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { draftQuery, useSaveDraft } from "@/features/auth/queries"
import { clearSessionDraft } from "@/features/listings/wizard/use-wizard-draft"
import { wizardDraftKey } from "@/features/listings/wizard/wizard-config"
import { useT } from "@/lib/i18n/use-t"

const key = wizardDraftKey()
// The server copy is written only on a step change or Save draft and exit, so any saved values mean the person started. Publish and Discard write `{}`.
const started = z.object({ values: z.record(z.string(), z.unknown()) })

// The unfinished wizard draft, above the Drafts table: continue it or throw it away.
export function DraftBanner({ dealer }: { dealer: boolean }) {
  const { t, locale } = useT()
  const [asking, setAsking] = useState(false)
  const draft = useQuery(draftQuery(key))
  const save = useSaveDraft(key)
  if (!started.safeParse(draft.data?.data).success) return null
  return (
    <section className="flex flex-col items-start gap-3 rounded-xl bg-accent p-4 text-accent-foreground">
      <h2 className="text-body font-semibold">{t("manager.draft_title")}</h2>
      <p className="text-ui">{t("manager.draft_body")}</p>
      <div className="flex flex-wrap gap-2">
        <Link
          to={dealer ? "/$locale/dealer/inventory/new" : "/$locale/post"}
          params={{ locale }}
          className={buttonVariants()}
        >
          {t("common.continue")}
        </Link>
        <Button type="button" variant="outline" onClick={() => setAsking(true)}>
          {t("manager.draft_discard")}
        </Button>
      </div>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t("manager.draft_discard_title")}
        description={t("manager.draft_discard_body")}
        confirmLabel={t("manager.draft_discard")}
        destructive
        pending={save.isPending}
        onConfirm={() => {
          clearSessionDraft(key)
          save.mutate({}, { onSettled: () => setAsking(false) })
        }}
      />
    </section>
  )
}
