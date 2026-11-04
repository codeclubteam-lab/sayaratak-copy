import { expect, test } from "bun:test"

import { apiIsRunning } from "~/shared/db/running-lock"

// 10.4: the real process. It boots on the test database, answers ready, and
// on SIGTERM stops taking requests, closes its pool and exits 0.
const API_DIR = `${import.meta.dir}/..`
const SECONDS = 1000

async function freePort() {
  const probe = Bun.serve({ port: 0, fetch: () => new Response() })
  const { port } = probe
  await probe.stop(true)
  return port
}

async function waitFor<T>(read: () => Promise<T | undefined>, ms: number) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    const found = await read().catch(() => undefined)
    if (found !== undefined) return found
    await Bun.sleep(100)
  }
  throw new Error("timed out")
}

test("SIGTERM drains, logs shutdown_done, releases the running lock and exits 0", async () => {
  const port = await freePort()
  const child = Bun.spawn(["bun", "src/index.ts"], {
    cwd: API_DIR,
    // Without the parent env the child would read the development database.
    env: { ...process.env, PORT: String(port), LOG_REQUESTS: "true" },
    stdout: "pipe",
    stderr: "pipe",
  })
  try {
    const base = `http://127.0.0.1:${port}`
    const up = await waitFor(async () => {
      const res = await fetch(`${base}/api/health/ready`)
      return res.status === 200 ? res : undefined
    }, 20 * SECONDS)
    expect(await up.json()).toMatchObject({ ok: true })
    expect(await apiIsRunning()).toBe(true)

    child.kill("SIGTERM")
    expect(await Promise.race([child.exited, Bun.sleep(25 * SECONDS)])).toBe(0)

    const out = await new Response(child.stdout).text()
    expect(out).toContain('"msg":"shutdown_started"')
    expect(out).toContain('"msg":"shutdown_done"')
    expect(out).toContain('"clean":true')
    await expect(fetch(`${base}/api/health/live`)).rejects.toThrow()
    expect(await apiIsRunning()).toBe(false)
  } finally {
    child.kill("SIGKILL")
  }
}, 60_000)
