// Dev panel settings live in cookies, so server rendering and loaders see them too (the mock router reads them).
export type FailMode = "none" | "500" | "404" | "422" | "offline"
export const failModes: FailMode[] = ["none", "500", "404", "422", "offline"]

const read = (name: string) =>
  document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.split("=")[1]
const write = (name: string, value: string | null) => {
  document.cookie = `${name}=${value ?? ""}; path=/; max-age=${value === null ? 0 : 60 * 60 * 24}; samesite=lax`
}

export const getFailMode = (): FailMode =>
  failModes.find((m) => m === read("mock_fail")) ?? "none"
export const setFailMode = (mode: FailMode) =>
  write("mock_fail", mode === "none" ? null : mode)
// null means the default 150 to 450 ms.
export const getLatency = () => {
  const raw = read("mock_latency")
  return raw === undefined ? null : Number(raw)
}
export const setLatency = (ms: number | null) =>
  write("mock_latency", ms === null ? null : String(ms))
