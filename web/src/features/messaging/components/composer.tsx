import type { KeyboardEvent } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useWatch } from "react-hook-form"

import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n/use-t"
import { messageSchema, type MessageForm } from "../schemas"
import { SendButton } from "./send-button"
import { useAppForm } from "@/hooks/use-app-form"

// Enter sends with a physical keyboard and Shift+Enter adds a line; on touch screens Enter adds a line and the button sends (A5b). The box grows to about six lines.
export function Composer({ onSend }: { onSend: (body: string) => void }) {
  const { t } = useT()
  const form = useAppForm<MessageForm>({
    resolver: zodResolver(messageSchema),
    defaultValues: { body: "" },
  })
  const empty = !useWatch({ control: form.control, name: "body" }).trim()
  const send = form.handleSubmit(({ body }) => {
    onSend(body)
    form.reset()
    form.setFocus("body")
  })
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return
    if (window.matchMedia("(pointer: coarse)").matches) return
    e.preventDefault()
    void send()
  }
  return (
    <form onSubmit={send} noValidate className="flex items-end gap-2 p-3">
      <Textarea
        rows={1}
        maxLength={1000}
        autoComplete="off"
        enterKeyHint="enter"
        aria-label={t("messages.composer_label")}
        className="max-h-40 min-h-(--control-h) resize-none"
        onKeyDown={onKeyDown}
        {...form.register("body")}
      />
      <SendButton disabled={empty} />
    </form>
  )
}
