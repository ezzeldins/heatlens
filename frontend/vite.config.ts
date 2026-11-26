import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Built files land in ../app/static so FastAPI serves them; `npm run dev` proxies /api to uvicorn.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/static/" : "/",
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: { outDir: "../app/static", emptyOutDir: true },
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
}));
