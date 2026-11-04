import { env } from "~/env"

/**
 * The command line of a Postgres client tool. The tool must be the server's major version, so
 * development sets `PG_CLIENT_CMD` to a Docker run of that version's image and it goes in front;
 * production leaves it blank because the API image carries the right client.
 */
export function pgTool(tool: "pg_dump" | "pg_restore", args: string[]) {
  return [...(env.PG_CLIENT_CMD?.split(" ") ?? []), tool, ...args]
}
