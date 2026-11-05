import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

// A18 freezes v1 even after deprecation. Disable lifecycle exceptions only in
// temporary comparison copies; the committed contracts stay untouched.
const [base, revision] = process.argv.slice(2)
if (!base || !revision) throw new Error("base and revision contracts required")
const directory = await mkdtemp(join(tmpdir(), "sayaratak-oasdiff-"))

async function comparisonCopy(source: string, name: string) {
  const text = await Bun.file(source).text()
  const document: unknown = JSON.parse(text, (key: string, value: unknown) => {
    if (key === "deprecated" && typeof value === "boolean") return false
    if (key === "x-stability-level" && typeof value === "string")
      return "stable"
    return value
  })
  const target = join(directory, name)
  await Bun.write(target, JSON.stringify(document))
  return target
}

try {
  const baseCopy = await comparisonCopy(base, "base.json")
  const revisionCopy = await comparisonCopy(revision, "revision.json")
  const result = Bun.spawnSync(
    [
      "oasdiff",
      "breaking",
      baseCopy,
      revisionCopy,
      "--fail-on",
      "WARN",
      "--format",
      "githubactions",
      "--match-path",
      "^/api/v1/",
      "--allow-external-refs=false",
      "--severity-levels",
      `${import.meta.dir}/../../.github/oasdiff-levels.txt`,
    ],
    { stdout: "inherit", stderr: "inherit" }
  )
  process.exitCode = result.exitCode
} finally {
  await rm(directory, { recursive: true, force: true })
}
