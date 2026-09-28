import coreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"
import prettier from "eslint-config-prettier"

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    // .next-* are the deploy's alternating build directories, .claude/ holds
    // agent worktrees (whole copies of the repo): neither is our source.
    ignores: [".next/**", ".next-*/**", ".claude/**", "node_modules/**", "public/**"],
  },
  // Imported directly - never through FlatCompat, which crashes here.
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
    // Build scripts are CLIs - stdout is their output, not a stray debug line.
    files: ["scripts/**"],
    rules: { "no-console": "off" },
  },
  // prettier stays last so it can switch off stylistic rules
  prettier,
]

export default config
