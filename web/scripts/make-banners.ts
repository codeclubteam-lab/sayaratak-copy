// Resizes the four banner photos in `assets-src/banners/` to `public/mock/banner-N.webp`. The text on a banner is real HTML (see `components/app/banner-item.tsx`), so only the photo is made here.
// Usage: bun scripts/make-banners.ts [photoDir] [outDir]
// Needs Google Chrome (CHROME env overrides the binary). Photos: home-top (4:3), home-middle, search-top, directory-top (16:9), as .jpg, .png or .webp.
import { spawn } from "node:child_process"
import { existsSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import process from "node:process"
import { setTimeout as sleep } from "node:timers/promises"

const photoDir = resolve(process.argv[2] ?? "assets-src/banners")
const outDir = resolve(process.argv[3] ?? "public/mock")

// The hero shows its photo up to about 600 px wide at 2x; a strip about 350 px wide at 2x.
const photos = [
  { n: 1, name: "home-top", w: 1200, h: 900 },
  { n: 2, name: "home-middle", w: 1000, h: 563 },
  { n: 3, name: "search-top", w: 1000, h: 563 },
  { n: 4, name: "directory-top", w: 1000, h: 563 },
]

const find = (name: string) => {
  const hit = ["jpg", "jpeg", "png", "webp"]
    .map((e) => join(photoDir, `${name}.${e}`))
    .find(existsSync)
  if (!hit)
    throw new Error(`missing photo: ${join(photoDir, name)}.(jpg|png|webp)`)
  return hit
}
// Fail before Chrome starts or anything is overwritten.
for (const p of photos) find(p.name)

const port = 9400 + Math.floor(Math.random() * 400)
const work = mkdtempSync(join(tmpdir(), "banners-"))
const chrome = spawn(
  process.env.CHROME ?? "google-chrome",
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${join(work, "profile")}`,
    "about:blank",
  ],
  { stdio: "ignore" }
)
try {
  let target: { webSocketDebuggerUrl: string } | undefined
  for (let i = 0; i < 50 && !target; i++) {
    try {
      const list = (await (
        await fetch(`http://127.0.0.1:${port}/json`)
      ).json()) as { type: string; webSocketDebuggerUrl: string }[]
      target = list.find((t) => t.type === "page")
    } catch {
      await sleep(200)
    }
  }
  if (!target) throw new Error("Chrome did not start")
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const pending = new Map<number, (v: { result?: any }) => void>()
  let loaded = () => {}
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data))
    if (m.method === "Page.loadEventFired") loaded()
    pending.get(m.id)?.(m)
  }
  const send = (method: string, params: object = {}) =>
    new Promise<{ result?: any }>((res) => {
      pending.set(++id, res)
      ws.send(JSON.stringify({ id, method, params }))
    })
  await send("Page.enable")
  for (const p of photos) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: p.w,
      height: p.h,
      deviceScaleFactor: 1,
      mobile: false,
    })
    const file = join(work, `b${p.n}.html`)
    writeFileSync(
      file,
      `<!doctype html><meta charset="utf-8"><style>*{margin:0}html,body{width:${p.w}px;height:${p.h}px;overflow:hidden}img{width:100%;height:100%;object-fit:cover}</style><img src="file://${find(p.name)}">`
    )
    const load = new Promise<void>((r) => (loaded = r))
    await send("Page.navigate", { url: `file://${file}` })
    await load
    await send("Runtime.evaluate", {
      expression: "document.images[0].decode().then(() => true)",
      awaitPromise: true,
    })
    const shot = await send("Page.captureScreenshot", {
      format: "webp",
      quality: 82,
    })
    writeFileSync(
      join(outDir, `banner-${p.n}.webp`),
      Buffer.from(shot.result.data, "base64")
    )
    console.log(`banner-${p.n}.webp`)
  }
  ws.close()
} finally {
  chrome.kill()
}
process.exit(0)
