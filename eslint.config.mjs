import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// ESLint 9 only picks up .js files by default; without this the .jsx components went unlinted.
const eslintConfig = [{ files: ["**/*.{js,jsx,mjs,cjs}"] }, ...compat.extends("next/core-web-vitals")];

export default eslintConfig;
