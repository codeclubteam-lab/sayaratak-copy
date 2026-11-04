import { zodResolver } from "@hookform/resolvers/zod"

import { FormField } from "@/components/app/form-field"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { useUpdateSavedSearch } from "@/features/search/queries"
import type { SavedSearch } from "@sayaratak/shared/schemas/saved-search"
import { renameSearchSchema, type RenameSearchForm } from "../schemas"
import { useAppForm } from "@/hooks/use-app-form"

// The form lives in its own component so every opening starts from the current name.
function RenameForm({
  search,
  onDone,
}: {
  search: SavedSearch
  onDone: () => void
}) {
  const { t } = useT()
  const update = useUpdateSavedSearch()
  const form = useAppForm<RenameSearchForm>({
    resolver: zodResolver(renameSearchSchema),
    mode: "onTouched",
    defaultValues: { name: search.name },
  })
  const submit = form.handleSubmit((values) =>
    update.mutate(
      { id: search.id, name: values.name },
      {
        onSuccess: () => {
          toast.add({ title: t("toast.search_renamed") })
          onDone()
        },
        onError: (error) => toast.add({ title: errorText(t, error) }),
      }
    )
  )
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormField
        label={t("dashboard.saved_searches_name_label")}
        error={form.formState.errors.name?.message}
      >
        {(control) => (
          <Input {...control} maxLength={60} {...form.register("name")} />
        )}
      </FormField>
      <div className="flex gap-3">
        <SubmitButton pending={update.isPending}>
          {t("common.save")}
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  )
}

export function RenameSearchDialog({
  search,
  onClose,
}: {
  search: SavedSearch | undefined
  onClose: () => void
}) {
  const { t } = useT()
  return (
    <ResponsiveDialog
      open={!!search}
      onOpenChange={(open) => !open && onClose()}
      title={t("dashboard.saved_searches_rename_title")}
    >
      {search && (
        <RenameForm key={search.id} search={search} onDone={onClose} />
      )}
    </ResponsiveDialog>
  )
}
