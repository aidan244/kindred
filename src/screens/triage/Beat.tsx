/**
 * One conversational beat's entrance (design-plan.md §14.5). Mounts
 * immediately but stays invisible for `delayMs`, then reveals itself —
 * opacity 0 -> 1 and translateY(6px) -> 0 over `--dur-enter`, `--ease-soft`.
 * Reduced motion keeps the delay (a pause, not an animation) but drops the
 * transition and translate entirely, appearing at full opacity.
 *
 * Callers gate WHETHER a beat renders at all on data (an answer existing, a
 * question having been reached, ...) — a beat only ever mounts once it is
 * genuinely reachable, and stable keys mean React never remounts one that's
 * already settled, so "messages never re-animate" falls out for free rather
 * than needing an explicit "already seen" ledger.
 */

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';

export interface BeatProps {
  /** Milliseconds to wait, from this beat's own mount, before revealing. */
  delayMs: number;
  reduced: boolean;
  className?: string;
  /** Called once, right after this beat reveals — the auto-scroll hook. */
  onReveal?: (element: HTMLDivElement) => void;
  children: ReactNode;
}

export function Beat({ delayMs, reduced, className, onReveal, children }: BeatProps): ReactElement {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const onRevealRef = useRef(onReveal);
  onRevealRef.current = onReveal;

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
    // Deliberately empty deps: a beat schedules its reveal exactly once, at
    // its own mount, and is never re-scheduled by a later re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (visible && ref.current) {
      onRevealRef.current?.(ref.current);
    }
  }, [visible]);

  const style = reduced
    ? { opacity: visible ? 1 : 0 }
    : {
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(6px)',
        transition:
          'opacity var(--dur-enter) var(--ease-soft), transform var(--dur-enter) var(--ease-soft)',
      };

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
