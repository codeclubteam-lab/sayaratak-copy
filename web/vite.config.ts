import { defineConfig, loadEnv } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"

import { readDeploymentConfig } from "./src/lib/server/deployment-config"

const config = defineConfig(({ command, mode }) => {
  const source = { ...loadEnv(mode, process.cwd(), ""), ...process.env }
  if (command === "build")
    readDeploymentConfig({
      ...source,
      NODE_ENV: "production",
    })
  return {
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools(),
      tailwindcss(),
      tanstackStart(),
      nitro({
        preset: "bun",
        plugins:
          command === "build" ? ["./src/lib/server/deployment-startup.ts"] : [],
        // Nitro also bundles the startup plugin outside Vite's SSR transform.
        replace: {
          "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
            source.VITE_API_BASE_URL ?? ""
          ),
        },
        rolldownConfig: {
          // Replaces Nitro's own filter, so its four codes stay listed. Libraries mark files "use client" for React Server Components, which this app does not use; the bundler dropping it is harmless (about 300 warnings per build).
          onwarn(warning, warn) {
            const quiet = [
              "EVAL",
              "CIRCULAR_DEPENDENCY",
              "THIS_IS_UNDEFINED",
              "EMPTY_BUNDLE",
            ]
            const directive =
              warning.code === "MODULE_LEVEL_DIRECTIVE" &&
              warning.message.includes("node_modules")
            if (!directive && !quiet.includes(warning.code ?? "")) warn(warning)
          },
        },
      }),
      viteReact(),
    ],
  }
})

export default config
