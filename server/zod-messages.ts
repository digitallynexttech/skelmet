import "server-only"

import { z } from "zod"

/**
 * Plain words for the schema rules written without their own message.
 *
 * A rule like `z.number().min(0)` answered in zod's words - "Too small:
 * expected number to be >=0" - and those reach staff as they are, now that
 * a rejected form names each field (lib/validation-message). A rule's own
 * message still wins; this only fills the gaps.
 *
 * Set once for the server, where every request body is parsed. Imported by
 * the two places that turn a schema failure into an answer, so it is in
 * place before any service parses anything.
 */
export function plainMessage(issue: {
  code: string
  origin?: string
  minimum?: number | bigint
  maximum?: number | bigint
  inclusive?: boolean
  exact?: boolean
  expected?: string
  format?: string
  input?: unknown
}): string | undefined {
  const blank = issue.input === undefined || issue.input === null || issue.input === ""
  switch (issue.code) {
    case "invalid_type":
      if (blank) return "Required"
      if (issue.expected === "number" || issue.expected === "int") return "Must be a number"
      if (issue.expected === "date") return "Must be a date"
      return "Not a valid value"
    case "too_small": {
      const n = Number(issue.minimum)
      if (issue.origin === "string") {
        if (n <= 1) return "Required"
        return issue.exact ? `Must be exactly ${n} characters` : `At least ${n} characters`
      }
      if (issue.origin === "array" || issue.origin === "set") {
        return n <= 1 ? "Choose at least one" : `Choose at least ${n}`
      }
      if (issue.origin === "date") return "That date is too early"
      return issue.inclusive === false ? `Must be more than ${n}` : `Must be ${n} or more`
    }
    case "too_big": {
      const n = Number(issue.maximum)
      if (issue.origin === "string") {
        return issue.exact ? `Must be exactly ${n} characters` : `${n} characters at most`
      }
      if (issue.origin === "array" || issue.origin === "set") return `${n} at most`
      if (issue.origin === "date") return "That date is too late"
      return issue.inclusive === false ? `Must be less than ${n}` : `${n} at most`
    }
    case "invalid_format":
      if (issue.format === "email") return "Not a valid email address"
      if (issue.format === "url") return "Not a valid link"
      if (issue.format === "uuid") return "Not a valid id"
      return "Not in the right format"
    case "invalid_value":
      return "Choose one of the options"
    default:
      return undefined
  }
}

z.config({ customError: (issue) => plainMessage(issue as Parameters<typeof plainMessage>[0]) })
