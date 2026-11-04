import { PhoneIncomingIcon } from "lucide-react"

import { initials } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { floatCard, mainCard } from "./styles"

const rows = [1, 2, 3]

// An inbox with unread buyer messages, and a new call floating over it.
export function InboxScene() {
  const { t } = useT()
  return (
    <>
      <div className={mainCard}>
        <div className="flex items-center gap-2">
          <p className="text-title font-semibold">{t("auth.scene_inbox")}</p>
          <span className="rounded-full bg-primary px-2 py-0.5 text-caption font-semibold text-primary-foreground">
            3
          </span>
        </div>
        <ul className="mt-4 flex flex-col">
          {rows.map((n) => (
            <li
              key={n}
              className="flex items-center gap-3 border-b border-border py-4 last:border-0"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-ui font-semibold text-primary">
                {initials(t(`auth.scene_name_${n}`))}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-ui font-semibold">
                  {t(`auth.scene_name_${n}`)}
                </p>
                <p className="truncate text-ui text-muted-foreground">
                  {t(`auth.scene_msg_${n}`)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-caption text-muted-foreground">
                  {t(`auth.scene_time_${n}`)}
                </span>
                {n < 3 && <span className="size-2 rounded-full bg-primary" />}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div
        className={`${floatCard} start-64 top-72 flex w-80 items-center gap-3`}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success/10 text-success">
          <PhoneIncomingIcon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-ui font-semibold">{t("auth.scene_new_lead")}</p>
          <p className="truncate text-caption text-muted-foreground">
            {t("auth.scene_new_lead_text")}
          </p>
        </div>
        <span className="text-caption text-muted-foreground">
          {t("auth.scene_now")}
        </span>
      </div>
    </>
  )
}
