import { useT } from "@/lib/i18n/use-t"
import { toast } from "@/components/ui/toast"
import { errorText } from "@/lib/api/error-text"
import { useToggleFavorite } from "./queries"

// Save and remove for the heart and for the favorites page. Removing answers with a toast that undoes it.
export function useFavoriteActions() {
  const { t } = useT()
  const { mutate } = useToggleFavorite()
  const fail = (error: unknown) => toast.add({ title: errorText(t, error) })
  const save = (id: string) => mutate({ id, on: true }, { onError: fail })
  const remove = (id: string) => {
    mutate({ id, on: false }, { onError: fail })
    toast.add({
      title: t("toast.favorite_removed"),
      actionProps: { children: t("common.undo"), onClick: () => save(id) },
    })
  }
  return { save, remove }
}
