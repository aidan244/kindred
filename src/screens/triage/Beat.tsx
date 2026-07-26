/**
 * One conversational beat's entrance (design-plan.md §14.5; handoff README
 * "Motion" — enter 420ms on `soft-out`). Mounts immediately but stays
 * invisible for `delayMs`, then reveals itself — opacity 0 -> 1 and
 * translateY(6px) -> 0 over `--dur-enter`, `--ease-soft`.
 *
 * Reduced motion keeps the delay (a pause between messages is rhythm, not
 * animation) but drops the transition, the translate and every stagger
 * entirely: the beat simply appears, at full opacity, when its turn comes.
 *
 * Callers gate WHETHER a beat renders at all on data (an answer existing, a
 * question having been reached, ...) — a beat only ever mounts once it is
 * genuinely reachable, and stable keys mean React never remounts one that's
 * already settled, so "messages never re-animate" falls out for free rather
 * than needing an explicit "already seen" ledger. That property is
 * load-bearing: a beat that re-animated on a round trip to review and back
 * would read as the conversation asking her something again.
 *
 * TWO ENTRANCE MODES. A bubble is one entering thing and animates itself
 * (`entrance="self"`, the default). A chip row is a container of several
 * entering things: the chips stagger themselves ~60ms apart (README 03/04's
 * wrapping chip rows), so the row must NOT also fade as a block — two nested
 * fades over the same pixels read as one slow smear rather than a stagger.
 * Those callers pass `entrance="children"`, which keeps the pause and the
 * reveal callback but flips the wrapper's opacity in one step and hands the
 * timing to the children via `useBeatRevealed()`.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

/**
 * The offset between one entering element and the next inside a group that
 * arrives together — handoff README "Motion" (enter 420ms) plus the staggered
 * chip entrance on 03/04. Exported so the conversation, the chip rows and the
 * follow-up widgets all stagger by the same number instead of three
 * hand-tuned ones.
 */
export const STAGGER_MS = 60;

/**
 * Whether the surrounding beat has revealed yet. Defaults to `true` so a
 * widget rendered WITHOUT a beat around it (the re-ask rows — see
 * CheckInConversation.tsx) starts already visible and never animates: a
 * re-ask is a correction she asked for, not a new message arriving.
 */
const BeatRevealContext = createContext(true);

export function useBeatRevealed(): boolean {
  return useContext(BeatRevealContext);
}

export interface BeatProps {
  /** Milliseconds to wait, from this beat's own mount, before revealing. */
  delayMs: number;
  reduced: boolean;
  /** See the header: `children` for chip rows and other groups that stagger
   * their own contents; `self` (default) for everything else. */
  entrance?: 'self' | 'children';
  className?: string;
  /** Called once, right after this beat reveals — the auto-scroll hook. */
  onReveal?: (element: HTMLDivElement) => void;
  children: ReactNode;
}

export function Beat({
  delayMs,
  reduced,
  entrance = 'self',
  className,
  onReveal,
  children,
}: BeatProps): ReactElement {
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

  // The wrapper still carries the opacity flip in `children` mode: its
  // contents must be genuinely invisible until their turn, even though the
  // motion itself belongs to them.
  const style =
    reduced || entrance === 'children'
      ? { opacity: visible ? 1 : 0 }
      : {
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(6px)',
          transition:
            'opacity var(--dur-enter) var(--ease-soft), transform var(--dur-enter) var(--ease-soft)',
        };

  return (
    <div ref={ref} className={className} style={style}>
      <BeatRevealContext.Provider value={visible}>{children}</BeatRevealContext.Provider>
    </div>
  );
}
