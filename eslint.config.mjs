import coreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"
import prettier from "eslint-config-prettier"

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: [".next/**", "node_modules/**", "design/**", "public/**"],
  },
  // Imported directly — never through FlatCompat, which crashes here.
  ...coreWebVitals,
  ...nextTypescript,
  {
    settings: {
      react: { version: "19.2" },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-console": ["warn", { allow: ["error", "warn"] }],
    },
  },
  {
    // Build scripts are CLIs — stdout is their output, not a stray debug line.
    files: ["scripts/**"],
    rules: { "no-console": "off" },
  },
  // prettier stays last so it can switch off stylistic rules
  prettier,
]

export default config
