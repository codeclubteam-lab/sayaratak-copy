import type { FeatureGroup } from "../use-spec-groups"

// The equipment of a vehicle as quiet chips, one row of chips per group. Text only, so it reads the same to every user.
export function FeatureList({ groups }: { groups: FeatureGroup[] }) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.id} className="flex flex-col gap-2">
          <h3 className="text-ui font-medium text-muted-foreground">
            {g.title}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {g.names.map((name) => (
              <li
                key={name}
                className="rounded-full bg-muted px-3 py-1 text-ui"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
