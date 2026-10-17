import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { host: "127.0.0.1" },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        shift02ThreeD: resolve(__dirname, "shift-02-3d.html")
      }
    }
  }
});