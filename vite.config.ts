import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  server: { host: "127.0.0.1" },
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, "index.html"),
        shift02ThreeD: resolve(rootDir, "shift-02-3d.html")
      }
    }
  }
});
