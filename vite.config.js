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
        materials: resolve(__dirname,'src/features/materials/materials.html'),
        production: resolve(__dirname,'src/features/production/production.html'),
        alerts: resolve(__dirname, './src/features/alerts/alerts.html'),
        conveyor: resolve(__dirname,'./src/features/conveyor/conveyor.html'),
        batches: resolve(__dirname,'./src/features/batches/batches.html'),
        users: resolve(__dirname, './src/features/users/users.html'),
        erro403: resolve(__dirname, './src/features/errors/403.html'),
        erro404: resolve(__dirname, './src/features/errors/404.html'),
        unavailable: resolve(__dirname, './src/features/errors/unavailable.html'),
        startProduction: resolve(__dirname, './src/features/start-production/start-production.html'),
        newSupplier: resolve(__dirname, './src/features/suppliers/new-supplier.html'),
        suppliers: resolve(__dirname, './src/features/suppliers/suppliers.html'),
        // uma linha por página
      },
    },
  },
});
