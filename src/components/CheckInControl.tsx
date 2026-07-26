/**
 * "Speak to Kindred" — handoff README, "CheckInControl".
 *
 * The one control that raises a concern, and the one control the README
 * requires to occupy "the same rectangle in the same position on every
 * screen". Two visual weights, one label, one behaviour:
 *
 *  - variant="primary" (Home's own CTA): 60px, full width, pill, accent
 *    fill, float shadow, KindredMark 24px.
 *  - variant="bar" (every other screen): 56px, surface fill, 1px line,
 *    float shadow, KindredMark 22px. Its label is `text` and NEVER
 *    `text-muted` — muted on a control this important reads as disabled,
 *    and this control is never disabled.
 *
 * STRUCTURAL RULE (changed): this component renders ONLY the button. It used
 * to carry its own `fixed` wrapper, which meant every screen that rendered it
 * was implicitly positioning a docked control — and two screens doing that
 * independently is exactly how the "same rectangle, same position" guarantee
 * gets lost. Position now belongs to the shared dock: `<DockHost>` owns the
 * one fixed rectangle (src/components/Dock.tsx) and screens render
 * `<Dock><CheckInControl …/><OperatorCall /></Dock>`. Do not reintroduce any
 * positioning here.
 *
 * Red is reserved for EmergencyCall alone (README, "Colour"), so the primary
 * weight is `bg-accent text-on-accent` — never the emergency token, which
 * would also fail contrast at 3.00:1.
 *
 * Press feedback is the shared `press` utility (opacity 0.82 / 120ms, no
 * scale, no colour change). No haptic: `hapticTick()` fires on chip select
 * and on send only.
 */

import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { KindredMark } from './KindredMark';
import { useAppState } from '../context/AppStateContext';
import { CHECK_IN_CONTROL_LABEL } from '../data/clinicalContent';

export interface CheckInControlProps {
  variant: 'primary' | 'bar';
}

/* The label lives in src/data/clinicalContent.ts and is imported, in this file
 * and in AlertFramingBlock alike. It used to be EXPORTED FROM HERE, which made
 * a component the source of truth for copy another component depended on — a
 * second, component-shaped copy module beside the real one. The label is also
 * quoted in prose throughout clinicalContent.ts (ALERT_FRAMING_BODY,
 * outcomeRoutineWaitNote), none of which could be kept in step with a constant
 * living over here. */

export function CheckInControl({ variant }: CheckInControlProps): ReactElement {
  const { entryPath, setEntryPath, alertActive } = useAppState();
  const navigate = useNavigate();

  const handlePress = (): void => {
    // Only set entryPath if no flow is already in progress, so re-pressing
    // "Speak to Kindred" mid-flow doesn't clobber how she originally entered
    // it. If an alert is currently active, a check-in started from here is an
    // alert-path check-in, not an ad hoc one — otherwise it could reach the
    // routine outcome despite starting from an active alert (the alert path
    // must only ever push towards escalation, never be mislabelled away
    // from it).
    if (entryPath === null) {
      setEntryPath(alertActive ? 'alert' : 'adhoc');
    }
    navigate('/triage');
  };

  const isPrimary = variant === 'primary';

  // `min-h-*` rather than a fixed `h-*`: the README's 60/56px are the resting
  // heights, but the control must still grow rather than clip when body text
  // is scaled to 200% (invariant: no fixed-height text containers). At the
  // default text size the padding never reaches the minimum, so the rendered
  // height is the README's number exactly. `min-h-*` is emitted after `tap`
  // in the utilities layer, so 60px wins over tap's 56px floor while tap's
  // min-width still applies.
  const sharedClasses =
    'tap press flex w-full items-center justify-center gap-3 rounded-pill px-6 py-2 text-label shadow-float';
  const primaryClasses = 'min-h-[60px] bg-accent text-on-accent';
  const barClasses = 'min-h-14 border border-line bg-surface text-text';

  return (
    <button
      type="button"
      onClick={handlePress}
      className={`${sharedClasses} ${isPrimary ? primaryClasses : barClasses}`}
    >
      {/* shrink-0: at 200% text the label wraps, and the mark must keep its
          drawn proportions rather than being squeezed by the flex row. */}
      <KindredMark size={isPrimary ? 24 : 22} className="shrink-0" />
      {CHECK_IN_CONTROL_LABEL}
    </button>
  );
}
