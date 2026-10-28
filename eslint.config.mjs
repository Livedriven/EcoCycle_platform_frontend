import js from "@eslint/js";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist/", "dist-demo/"]),
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser }, },
  { files: ["mocks/**/*.cjs"], languageOptions: { sourceType: "commonjs", globals: globals.node } },
  { files: ["**/*.test.js"], languageOptions: { globals: { ...globals.browser, ...globals.node } } },
]);
