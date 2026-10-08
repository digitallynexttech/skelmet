import coreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"
import prettier from "eslint-config-prettier"

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    // .next-*: deploy build dirs. .claude/: agent worktrees.
    ignores: [".next/**", ".next-*/**", ".claude/**", "node_modules/**", "public/**"],
  },
  // Imported directly: FlatCompat crashes here.
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
    // CLIs: stdout is their output.
    files: ["scripts/**"],
    rules: { "no-console": "off" },
  },
  // Last, to switch off stylistic rules.
  prettier,
]

export default config
