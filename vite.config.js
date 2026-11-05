import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Replicando o __dirname de forma segura para ES Modules
const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Cacheia a estrutura estática do portal; respostas da API ficam só no IndexedDB.
const offlineShell = {
  name: "ecocycle-offline-shell",
  apply: "build",
  generateBundle: {
    order: "post",
    handler(_opcoes, bundle) {
      const worker = readFileSync(new URL("./src/shared/offline-sw.js", import.meta.url), "utf8");
      const versao = createHash("sha256").update(worker);
      const arquivos = [];
      for (const [nome, item] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) {
        if (!/\.(html|js|css|woff2?|png|svg)$/.test(nome)) continue;
        arquivos.push("/" + nome);
        versao.update(nome).update(item.type === "asset" ? item.source : item.code);
      }
      for (const nome of ["favicon.svg", "img/logo.png"]) {
        arquivos.push("/" + nome);
        versao.update(nome).update(readFileSync(resolve(__dirname, "public", nome)));
      }
      const nomeCache = "ecocycle-shell-" + versao.digest("hex").slice(0, 16);
      this.emitFile({
        type: "asset", fileName: "offline-sw.js",
        source: `const ARQUIVOS = ${JSON.stringify(arquivos)};\nconst NOME_CACHE = ${JSON.stringify(nomeCache)};\n${worker}`,
      });
    },
  },
};

export default defineConfig({
  plugins: [offlineShell],
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
        conveyorStatus: resolve(__dirname,'./src/features/conveyor/conveyor-status.html'),
        batches: resolve(__dirname,'./src/features/batches/batches.html'),
        users: resolve(__dirname, './src/features/users/users.html'),
        erro403: resolve(__dirname, './src/features/errors/403.html'),
        erro404: resolve(__dirname, './src/features/errors/404.html'),
        unavailable: resolve(__dirname, './src/features/errors/unavailable.html'),
        startProduction: resolve(__dirname, './src/features/start-production/start-production.html'),
        newSupplier: resolve(__dirname, './src/features/suppliers/new-supplier.html'),
        suppliers: resolve(__dirname, './src/features/suppliers/suppliers.html'),
        newBatch: resolve(__dirname, './src/features/batches/new-batch.html'),
        productionMonitoring: resolve(__dirname, './src/features/production/production-monitoring.html'),
        productionProgress: resolve(__dirname, './src/features/production/production-progress.html'),
        // uma linha por página
      },
    },
  },
});
