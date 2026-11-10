import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { useState } from "react"

import { apiFetch } from "@/lib/api/client"
import { keys } from "@/lib/api/query-keys"
import { okSchema } from "@sayaratak/shared/schemas/api"
import { meQuery } from "@/features/auth/me-query"
import { useLogin, useLogout } from "@/features/auth/queries"
import { authGate } from "@/features/auth/auth-gate"
import { useResetDemoData } from "@/features/admin/queries"
import { SelectInput } from "./select-input"
import {
  failModes,
  getFailMode,
  getLatency,
  setFailMode,
  setLatency,
  type FailMode,
} from "@/lib/api/dev-flags"

const accounts = [
  { label: "User (Omar)", identifier: "user@demo.sy" },
  { label: "Dealership", identifier: "dealer@demo.sy" },
  { label: "Workshop", identifier: "workshop@demo.sy" },
  { label: "Mechanic", identifier: "mechanic@demo.sy" },
  { label: "Admin", identifier: "admin@demo.sy" },
  { label: "New user (no role)", identifier: "new@demo.sy" },
]

// Dev only, so the labels are plain English. Each change re-runs the loaders to show the matching state.
export function DevPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const qc = useQueryClient()
  const me = useQuery(meQuery)
  const login = useLogin()
  const logout = useLogout()
  const reset = useResetDemoData()
  const [fail, setFail] = useState<FailMode>(getFailMode)
  const [latency, setLatencyState] = useState(getLatency)
  const refresh = () => router.invalidate()

  return (
    <aside
      aria-label="Dev panel"
      className="fixed start-4 bottom-4 z-50 flex w-72 flex-col gap-3 rounded-lg bg-card p-4 text-ui shadow-floating"
    >
      <div className="flex items-center justify-between">
        <strong>Dev panel</strong>
        <button type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <label className="flex flex-col gap-1">
        Failure
        <SelectInput
          value={fail}
          options={failModes.map((m) => ({ value: m, label: m }))}
          onChange={(v) => {
            const mode = failModes.find((m) => m === v) ?? "none"
            setFailMode(mode)
            setFail(mode)
            void refresh()
          }}
        />
      </label>
      <label className="flex flex-col gap-1">
        Latency:{" "}
        {latency === null ? "default (150 to 450 ms)" : `${latency} ms`}
        <input
          type="range"
          min={0}
          max={3000}
          step={50}
          value={latency ?? 300}
          onChange={(e) => {
            setLatency(Number(e.target.value))
            setLatencyState(Number(e.target.value))
          }}
        />
        <button
          type="button"
          onClick={() => {
            setLatency(null)
            setLatencyState(null)
          }}
        >
          Use default
        </button>
      </label>
      <label className="flex flex-col gap-1">
        Signed in as:{" "}
        {me.data ? `${me.data.fullName} (${me.data.role})` : "nobody"}
        <SelectInput
          value=""
          placeholder="Switch account"
          options={[
            ...accounts.map((a) => ({ value: a.identifier, label: a.label })),
            { value: "out", label: "Sign out" },
          ]}
          onChange={async (v) => {
            if (!v) return
            if (v === "admin@demo.sy") {
              await logout.mutateAsync()
              authGate.setState(() => ({
                open: true,
                pending: () => void refresh(),
              }))
              onClose()
              return
            }
            if (v === "out") await logout.mutateAsync()
            else
              await login.mutateAsync({
                email: v,
                password: "Demo1234",
              })
            void refresh()
          }}
        />
      </label>
      <button
        type="button"
        onClick={() =>
          apiFetch("/mock/expire-session", { method: "POST", schema: okSchema })
        }
      >
        Expire session (next call gets 401)
      </button>
      <button
        type="button"
        onClick={async () => {
          await apiFetch("/mock/ban-me", { method: "POST", schema: okSchema })
          await qc.invalidateQueries({ queryKey: keys.me })
          void refresh()
        }}
      >
        Ban signed-in account
      </button>
      <button
        type="button"
        disabled={reset.isPending}
        onClick={async () => {
          await reset.mutateAsync()
          window.location.reload()
        }}
      >
        Reset data
      </button>
    </aside>
  )
}
