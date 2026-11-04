import { createFileRoute } from "@tanstack/react-router"

import { taxonomyQuery } from "@/features/listings/queries"
import { wizardSearchSchema } from "@/features/listings/wizard/wizard-config"
import { WizardPage } from "@/features/listings/wizard/wizard-page"
import { getCopy } from "@/lib/i18n/server"
import { buildHead } from "@/lib/seo"

// Open to everyone: a visitor fills the wizard signed out and signs in at Publish. `edit` loads one of the owner's listings into it.
export const Route = createFileRoute("/$locale/post")({
  validateSearch: wizardSearchSchema,
  loader: async ({ context }) => {
    const [[title = ""]] = await Promise.all([
      getCopy({ data: { locale: context.locale, keys: ["listing.post"] } }),
      context.queryClient.ensureQueryData(taxonomyQuery),
    ])
    return { title, locale: context.locale }
  },
  head: ({ loaderData }) =>
    loaderData
      ? buildHead({ ...loaderData, path: "/post", noindex: true })
      : {},
  component: function Post() {
    const { step, edit, listing } = Route.useSearch()
    const navigate = Route.useNavigate()
    return (
      <WizardPage
        context="public"
        step={step}
        editId={edit}
        savedId={listing}
        onSaved={(id) =>
          void navigate({ search: { step: "done", listing: id } })
        }
      />
    )
  },
})
