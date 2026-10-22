import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

// Replicando o __dirname de forma segura para ES Modules
const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        login: resolve(__dirname, "src/features/login/login.html"),
        dashboard: resolve(__dirname, "src/features/dashboard/dashboard.html"),
        // uma linha por página
      },
    },
  },
});
