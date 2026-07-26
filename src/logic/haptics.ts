/**
 * The product's only haptic — handoff README, motion_and_accessibility:
 * "Light haptic tick on chip select and on send. No haptic on the emergency
 * or operator controls."
 *
 * That exclusion is a safety rule, not a preference: a buzz on the call
 * controls would make the one action she may need to take at 3am feel like
 * an alarm going off in her hand. Those controls never animate and never
 * vibrate. There is deliberately no `strong` or `warning` variant here for
 * anyone to reach for.
 *
 * `navigator.vibrate` is absent on iOS Safari and on desktop; this is a
 * no-op there rather than a capability anything branches on — a tick is a
 * garnish on an interaction that already gave visual feedback (opacity to
 * 0.82), never the feedback itself.
 */

/** Milliseconds. Short enough to read as a tick rather than a buzz. */
const TICK_MS = 8;

export function hapticTick(): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  try {
    navigator.vibrate(TICK_MS);
  } catch {
    // Some browsers throw when the page has never been interacted with, or
    // when vibration is blocked by policy. A missing tick is not an error
    // worth surfacing anywhere.
  }
}
