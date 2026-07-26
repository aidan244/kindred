/**
 * Home — handoff README, screens "01 Home — steady" and "02 Home — opened
 * from the notification".
 *
 * ONE component for both, because they are one screen: 02 is 01 with the
 * notification's framing block in it. `alertActive` (AppStateContext) is the
 * only switch, and it is set by the simulated push banner in DemoPanel, not
 * here.
 *
 * Purpose (README §01): reassurance at a glance, and one tap to raise a
 * concern. Composition, top to bottom — greeting → the Kindred avatar in its
 * breathing lamp glow → two muted metadata captions → the live-data card →
 * (docked) Speak to Kindred + the operator route.
 *
 * Safety rule: this screen shows the shape of the data and STOPS. No summary,
 * no score, no interpretation in words — a number, a trace, a plain sync
 * timestamp, and two ways forward. The card's offline variant is a statement
 * about the hardware, never about the baby, and it is LiveDataCard's own
 * business (it reads `bandOffline`); this screen does not branch on it.
 *
 * WHAT THIS SCREEN DELIBERATELY DOES NOT RENDER — all three are hoisted, and
 * duplicating any of them would break the invariant it exists to protect:
 *  - the aura backdrop — mounted once in App (src/components/Aura.tsx);
 *  - the docked controls and the fade behind them — owned by the shared dock
 *    rectangle (src/components/Dock.tsx). This screen renders `<Dock>` and
 *    its children are portalled there, so the Speak-to-Kindred control keeps
 *    the same rectangle in the same position as on every other screen;
 *  - its own entrance animation — RouteTransition wraps the router.
 *
 * TWO SPACING RHYTHMS, one per screen state:
 *  - 01 uses the README's bespoke margins: avatar `20px auto 4px`, then the
 *    captions 20px above (4px apart), then the card 20px above.
 *  - 02 replaces the whole rhythm with a uniform 24px stack, and the avatar
 *    gives way to AlertFramingBlock. That is the reference board, and it is
 *    forced rather than aesthetic: greeting + framing block + captions + card
 *    + the 112px dock clearance already fills an 844px frame, so a 96px
 *    avatar and its margins would push the card — the thing the alert is
 *    asking her to look at — under the dock. The alert is the focus, which is
 *    the same reason the card drops its number row here (`showNumber`).
 */

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertFramingBlock } from '../components/AlertFramingBlock';
import { CheckInControl } from '../components/CheckInControl';
import { Dock } from '../components/Dock';
import { KindredAvatar } from '../components/KindredAvatar';
import { LiveDataCard } from '../components/LiveDataCard';
import { useAppState } from '../context/AppStateContext';
import {
  HOME_OPEN_TRENDS,
  HOME_WINDOW_LABEL,
  homeGreeting,
  homeSyncedAgo,
  patientFixture,
} from '../data/clinicalContent';
import { getMovementStream } from '../sensors/MovementStream';

const FIRST_NAME = patientFixture.name.split(' ')[0];

/** The 96px box the README puts the avatar in (the glow and the figure both
 * scale off it — see KindredAvatar). */
const AVATAR_SIZE = 96;

// How often the "synced ... ago" line quietly recomputes. Not an animation —
// a plain metadata string, updated the way any ordinary app keeps a
// timestamp honest, not a visible counter (design-plan.md rule 6 bans
// counters; this never renders more than one static line of text). 30s is
// well under the 1-minute granularity the string itself has, so the text is
// never observably stale.
const SYNC_REFRESH_MS = 30000;

/* The greeting and the seven sync-status strings used to be built in this
 * file. They are patient-facing — and "Not yet synced" in particular is a
 * statement about the band's state, sitting directly above LiveDataCard's own
 * band-offline sentence, so two files were describing the same absence in two
 * vocabularies. Both formatters now live in src/data/clinicalContent.ts next
 * to `bandOfflineCopy`, where the three lines are reviewed as one voice. */

export default function Home(): ReactElement {
  const { alertActive, setAlertActive, entryPath, setEntryPath, activityVariant } = useAppState();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setTick((current) => current + 1), SYNC_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  // `tick` is a dependency on purpose: it is the only thing that makes this
  // re-read the stream, which is how the sync line stays honest without the
  // stream having to push.
  const latestSampleAt = useMemo(() => {
    const samples = getMovementStream(activityVariant).getWindow(24);
    return samples.length > 0 ? samples[samples.length - 1].timestamp : null;
  }, [activityVariant, tick]);

  const syncedCopy = homeSyncedAgo(latestSampleAt, Date.now());

  // Mirrors CheckInControl's own guard: only claim the entry path if no
  // flow is already in progress, so this never mislabels a flow entered
  // another way.
  const handleAlertCheckIn = (): void => {
    if (entryPath === null) {
      setEntryPath('alert');
    }
    navigate('/triage');
  };

  // One tap, never a confirmation dialog. Clears the 'alert' entry path
  // too, so a later ad hoc check-in isn't mislabelled as having come from
  // this notification.
  const handleDismiss = (): void => {
    setAlertActive(false);
    if (entryPath === 'alert') {
      setEntryPath(null);
    }
  };

  const handleOpenLiveView = (): void => {
    navigate('/live');
  };

  const handleOpenTrends = (): void => {
    navigate('/trends');
  };

  return (
    <>
      {/* README §01: `padding: 32px 24px 0`, content max-width 420, centred.
          The top inset is added to the 32px rather than replacing it, so the
          greeting keeps its designed distance from the notch on hardware
          that has one. `dock-safe` is the 112px the dock clears; no content
          may enter it. */}
      <div
        className={`mx-auto w-full max-w-[var(--content-max)] px-6 pt-[calc(env(safe-area-inset-top,0px)+32px)] dock-safe${
          alertActive ? ' flex flex-col gap-6' : ''
        }`}
      >
        <h1 className="text-display text-text">{homeGreeting(FIRST_NAME)}</h1>

        {alertActive ? (
          <AlertFramingBlock onCheckIn={handleAlertCheckIn} onDismiss={handleDismiss} />
        ) : (
          /* Decorative presence, not a status light: it carries no face, no
             expression and no colour change, and KindredAvatar marks it
             aria-hidden itself. `mx-auto mt-5 mb-1` is the README's
             `margin: 20px auto 4px`. */
          <KindredAvatar size={AVATAR_SIZE} className="mx-auto mt-5 mb-1" />
        )}

        {/* The two muted captions, 4px apart, 20px above (on 02 the column's
            own 24px gap supplies the space instead). Grouped so they move as
            one block in either rhythm. */}
        <div className={alertActive ? undefined : 'mt-5'}>
          <p className="text-caption text-text-muted">{HOME_WINDOW_LABEL}</p>
          <p className="mt-1 text-caption text-text-muted">{syncedCopy}</p>
        </div>

        {/* `showNumber={false}` on 02: the alert is what she opened the app
            for, and a 56px number beside it would compete with it. */}
        <div className={alertActive ? undefined : 'mt-5'}>
          <LiveDataCard showNumber={!alertActive} onOpenLiveView={handleOpenLiveView} />
        </div>

        {/* Trends' one entry point. Hidden on 02 for the same reason the
            card drops its number row there: the alert is the focus, and a
            second, unrelated way forward would compete with it. */}
        {!alertActive && (
          <button
            type="button"
            onClick={handleOpenTrends}
            className="press tap mt-3 block w-full text-center text-caption text-accent"
          >
            {HOME_OPEN_TRENDS}
          </button>
        )}
      </div>

      {/* The dock. Primary weight on 01, where Speak to Kindred is this
          screen's own CTA; bar weight on 02, where AlertFramingBlock is
          already offering the same action in the flow of the page and two
          filled accent pills would read as two different actions. Same
          rectangle, same position, same label either way. OperatorCall is the
          last child of every dock in the product. */}
      <Dock>
        <CheckInControl variant={alertActive ? 'bar' : 'primary'} />
      </Dock>
    </>
  );
}
