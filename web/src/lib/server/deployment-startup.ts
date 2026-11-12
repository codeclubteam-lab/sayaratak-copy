import { readDeploymentConfig } from "./deployment-config"

// Nitro's synchronous startup plugin runs before listening; the TanStack entry is lazy.
export default function validateDeployment() {
  const source = { ...process.env, NODE_ENV: "production" }
  readDeploymentConfig(source)
  readDeploymentConfig({
    ...source,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? "",
  })
}
