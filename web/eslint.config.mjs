import { createRequire } from "module";

const require = createRequire(import.meta.url);
const nextVitals = require("eslint-config-next/core-web-vitals");
const nextTs = require("eslint-config-next/typescript");

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "out/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    rules: {
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/incompatible-library": "off",
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
];

export default eslintConfig;
