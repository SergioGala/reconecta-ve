import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: ["public/sw.js", "public/swe-worker-*.js", ".next/**"],
  },
  ...nextJsConfig,
];