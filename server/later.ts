import "server-only"

import { after } from "next/server"

/** After the response; outside a request (script, test) `after` throws, so it runs now. */
export function later(task: () => Promise<void>): void {
  try {
    after(task)
  } catch {
    void task()
  }
}
