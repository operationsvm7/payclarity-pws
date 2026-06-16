import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router"],
  },
  server: {
    port: 5173,
  },
});
