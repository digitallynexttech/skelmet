import "server-only"

import { after } from "next/server"

/**
 * Runs `task` once the response has gone out. Outside a request - a script,
 * a test - `after` throws, and the task simply runs now instead.
 */
export function later(task: () => Promise<void>): void {
  try {
    after(task)
  } catch {
    void task()
  }
}
