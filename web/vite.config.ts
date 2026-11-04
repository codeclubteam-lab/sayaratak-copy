import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    nitro({
      preset: "bun",
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
})

export default config
