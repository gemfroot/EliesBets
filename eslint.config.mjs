import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Node deploy scripts (CommonJS require)
    "contracts/**",
    // Throwaway local scripts — gitignored, don't deserve the same rules as app source
    "_claude_local/**",
  ]),
  {
    rules: {
      // Honor the leading-underscore "intentionally discarded" convention so
      // destructure-and-drop patterns (e.g. `data: _writeData` to remove a
      // field from a spread) don't fight the linter.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
