/**
 * The dock — handoff README, "Docks".
 *
 * HOISTED AND SHARED. `DockHost` renders ONE fixed rectangle, mounted above
 * the router in src/App.tsx, outside anything keyed by pathname. Screens do
 * not render their own docked controls; they render `<Dock>` and their
 * content is portalled into that same rectangle. The container therefore
 * never unmounts, never re-keys, and never participates in a route
 * transition — which is exactly the README's requirement that "the aura, the
 * dock and the emergency control must not animate or reflow during a
 * transition" and that the Speak-to-Kindred control "occupies the same
 * rectangle in the same position on every screen".
 *
 * A portal rather than a config object registered from each screen: the
 * outcome screen's dock depends on a disposition it snapshots at its own
 * mount, and the review dock owns a send handler — both are things the
 * screen knows and a central deriver would have to reach down for. Portalled
 * children keep that knowledge where it already lives while still landing in
 * the one shared rectangle.
 *
 * Two geometries, per the README:
 *  - `standard` (non-triage): column, 24px gutters, 4px gaps, bottom 16px,
 *    with a 184px fade behind it.
 *  - `tall` (triage / review / outcome): the same column at 12px gaps, but
 *    the dock itself carries `48px 24px 16px` of padding and a
 *    `to top, bg 66%, transparent` gradient, because it is stacking a call
 *    control, a note and the operator route rather than one control.
 *
 * NO HOST, STILL A DOCK. If a screen is mounted without `DockHost` above it
 * — a test harness rendering one route in isolation, or any future embedding
 * that forgets the provider — this component renders the SAME rectangle in
 * place rather than returning null. That is not defensive tidiness: the dock
 * is where the emergency and operator routes live, and a dock that vanished
 * because of a wiring mistake would be an absence NOBODY CHOSE and nobody
 * reading the screen's source would see. The fallback is the identical markup
 * in an identical fixed rectangle, so there is one geometry either way; the
 * only thing lost is the portal's guarantee that the rectangle survives a
 * route transition without re-mounting.
 *
 * That is a narrower claim than "every dock contains an emergency control",
 * and deliberately so. WHICH controls a dock carries is the README's decision,
 * per screen, and it differs: §03/§04/§05 stack EmergencyCall + the 999 note +
 * the operator row; §01/§02/§08 stack CheckInControl + the operator row; §06's
 * review dock is the send pill + its note + the operator row, with no
 * emergency control at all (see ReviewStep.tsx, which states why). Every one
 * of those is a composition chosen and visible at the call site. This
 * fallback is only about the rectangle itself never disappearing underneath
 * whichever composition a screen chose.
 *
 * CLEARANCE IS MEASURED, NOT ASSUMED. `DockHost` publishes the rectangle's
 * real height as `--dock-height` on the document element, which the
 * `dock-safe` / `dock-safe-tall` utilities (src/index.css) take the max of
 * against their static floors. A constant cannot stay correct once the dock's
 * children grow — which they do, both when a screen adds a row and when she
 * turns her text size up — and "content never enters the dock clearance"
 * (invariant 4) has to survive both.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

const DockHostContext = createContext<HTMLDivElement | null>(null);

/**
 * The element every dock portals into. Exposed so the check-in conversation
 * can measure how much of the viewport the dock is covering when it scrolls
 * a new beat into view — it must never scroll a message to a position the
 * dock is sitting on top of.
 */
export function useDockElement(): HTMLDivElement | null {
  return useContext(DockHostContext);
}

/**
 * Mounts the shared dock rectangle and makes it available to every screen
 * below. Renders `children` (the router) first and the rectangle after, so
 * the dock stacks above screen content without either needing a z-index
 * relative to the other beyond the one set here.
 */
export function DockHost({ children }: { children: ReactNode }): ReactElement {
  // A callback ref into state, rather than a plain ref: the portal target
  // has to trigger a render once it exists. React commits this during the
  // same pass as the initial mount, before paint, so the dock is never
  // visibly absent for a frame.
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  // Publishes the rectangle's REAL height as `--dock-height`, which the
  // `dock-safe` utilities take the max of against their static floors (see
  // the header). The floors alone are not enough: the standard dock measures
  // 136px at rest against a 112px token, and both docks grow well past their
  // floors once she scales text — the label wraps, the paddings grow, and the
  // reserved padding would not.
  //
  // The absolutely-positioned fade behind the standard dock contributes
  // nothing to this height, which is right: the fade is meant to have content
  // pass under it. Only the control stack has to be cleared.
  useEffect(() => {
    if (!node) {
      return undefined;
    }
    const root = document.documentElement;
    const publish = (): void => {
      // Ceil, never round: half a pixel short of clearance is still content
      // under a tappable control.
      root.style.setProperty('--dock-height', `${Math.ceil(node.getBoundingClientRect().height)}px`);
    };
    publish();

    // ResizeObserver is the only thing that sees a child growing. Where it
    // does not exist (jsdom, and anything older), the static floors carry the
    // clearance on their own — `--dock-height` simply reads 0 and loses every
    // max().
    if (typeof ResizeObserver === 'undefined') {
      return () => root.style.removeProperty('--dock-height');
    }
    const observer = new ResizeObserver(publish);
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--dock-height');
    };
  }, [node]);

  return (
    <DockHostContext.Provider value={node}>
      {children}
      <div ref={setNode} className={HOST_RECT_CLASSES} />
    </DockHostContext.Provider>
  );
}

export interface DockProps {
  /** `tall` on the triage, review and outcome screens — see the header. */
  variant?: 'standard' | 'tall';
  children: ReactNode;
}

const SAFE_BOTTOM = 'max(16px, env(safe-area-inset-bottom, 0px))';

/** The host rectangle's own classes, repeated by the no-host fallback below
 * so the two paths cannot drift into two different geometries. */
const HOST_RECT_CLASSES = 'pointer-events-none fixed inset-x-0 bottom-0 z-30';

/**
 * The control column, shared by both variants.
 *
 * THE COLUMN ITSELF IS NOT INTERACTIVE — only its direct children are. This
 * looks like a detail and is not: the column is a full-width fixed element
 * carrying up to 48px of transparent top padding, sitting over the top of
 * the conversation. When the column was `pointer-events-auto`, that padding
 * swallowed every click that landed in it, so an answer chip that happened
 * to sit in the strip above the dock could be pressed and simply do nothing
 * — no feedback, no error, the whole row apparently dead.
 *
 * jsdom does not hit-test, so no test in this suite could see it; a repro
 * that clicked the chip by role passed happily while the real button was
 * unreachable. Anything added here must keep `pointer-events` on the
 * children rather than the container.
 */
const DOCK_COLUMN_CLASSES =
  'pointer-events-none [&>*]:pointer-events-auto relative mx-auto flex w-full max-w-[var(--content-max)] flex-col items-center px-6';

export function Dock({ variant = 'standard', children }: DockProps): ReactElement {
  const host = useDockElement();

  // BOTH FADES ARE FULL-BLEED. The reference draws each one `left:0;right:0`,
  // which is indistinguishable from painting it on the content column at the
  // 390px design width — but not at any width above `--content-max`. The tall
  // variant used to carry its gradient as the background of the 420px column
  // itself, so a wide viewport showed a faded 420px strip with unfaded content
  // scrolling past on either side of it. The gradient is its own inset-x-0
  // element in both variants now; only its height and stops differ.
  const content =
    variant === 'tall' ? (
      <>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(to top, var(--bg) 66%, transparent)' }}
        />
        <div
          className={`${DOCK_COLUMN_CLASSES} gap-3 pt-12`}
          style={{ paddingBottom: SAFE_BOTTOM }}
        >
          {children}
        </div>
      </>
    ) : (
      <>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[184px]"
          style={{ background: 'linear-gradient(to top, var(--bg), transparent)' }}
        />
        <div className={`${DOCK_COLUMN_CLASSES} gap-1`} style={{ paddingBottom: SAFE_BOTTOM }}>
          {children}
        </div>
      </>
    );

  // See the header: no host is still a dock, never nothing.
  if (!host) {
    return <div className={HOST_RECT_CLASSES}>{content}</div>;
  }

  return <>{createPortal(content, host)}</>;
}
