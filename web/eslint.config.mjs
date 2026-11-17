import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Скопировано из библиотеки компонентов как есть.
    "src/components/ai-chat/prompt-bar/**",
    "public/landing/js/**",
    "public/sw.js",
  ]),
]);
