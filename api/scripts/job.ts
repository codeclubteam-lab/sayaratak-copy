import { jobs } from "~/jobs"
import { runJob } from "~/shared/jobs/run-job"

// Runs one scheduled job once, by hand: bun run job <name>
const name = process.argv[2]
const job = jobs.find((candidate) => candidate.name === name)
if (!job) {
  const known = jobs.map((candidate) => candidate.name).join(", ") || "none yet"
  process.stderr.write(`Usage: bun run job <name>. Jobs: ${known}\n`)
  process.exit(1)
}

const outcome = await runJob(job)
if (outcome === "skipped") {
  process.stderr.write(`${name} is running in another process; nothing done\n`)
}
process.exit(outcome === "done" ? 0 : 1)
