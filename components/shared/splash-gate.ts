/**
 * Lets a heavy above-the-fold asset ask the splash to stay down while it
 * loads, so the visitor never watches it arrive.
 *
 * Inverted on purpose. If the splash went looking for the hero instead, it
 * would have to know which routes have one - and it lives in the marketing
 * layout, which is every storefront route. A hold that nobody takes leaves the
 * splash on its normal clock, so /about and /contact are untouched.
 *
 * Timing is safe without any handshake: a hold is taken in a layout effect on
 * mount, and the splash cannot decide to leave before `MIN_HOLD_MS`, which is
 * orders of magnitude later. The splash reads the count once per frame rather
 * than subscribing, because it is already running a rAF loop for the progress
 * bar - a listener would buy nothing.
 *
 * Holds never trap anyone. The splash's own ceiling overrides the count, and
 * every caller is expected to release on failure as well as on success.
 */

let holds = 0

/** Ask the splash to wait. The returned release is idempotent. */
export function holdSplash(): () => void {
  holds += 1
  let released = false
  return () => {
    if (released) return
    released = true
    holds = Math.max(0, holds - 1)
  }
}

export function splashHoldCount(): number {
  return holds
}
