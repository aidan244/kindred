/**
 * The home 24-hour ambient band — design-plan.md §8. A still record, not a
 * live thing: a scattering of warm embers, dense where she was moving, thin
 * where she was not. Shows the shape of the last day and stops.
 *
 * Safety rule: only two things are ever driven by data — whether a bucket
 * renders an ember at all (a bucket with no movement renders nothing:
 * absence is absence, not a baseline row), and, for a bucket that does,
 * its magnitude, shown as marker radius and lamp tone (movedCount 1/2/3 ->
 * r 1.1/1.6/2.1, lamp-3/4/5). Vertical position (cy) is deterministic
 * jitter that encodes nothing and must never be mapped to movedCount — or
 * anything else — or this becomes a bar chart, then a CTG trace. No axis,
 * no gridlines, no "now" marker, no numbers, no summary sentence — just the
 * shape, and the two orientation labels.
 */

import { useId, useMemo, type ReactElement } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';
import { getMovementStream } from '../sensors/MovementStream';
import type { ActivityVariant } from '../types';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export interface EmberBandProps {
  variant: ActivityVariant;
  onOpenLiveView: () => void;
}

const BUCKET_COUNT = 96;
const BUCKET_MS = 15 * 60 * 1000;
const VIEW_WIDTH = 342;
const VIEW_HEIGHT = 96;

// Six phase groups (§8.5): distinct durations/delays so the shimmer never
// sweeps or scans across the band — it just breathes, unevenly, like ash.
const PHASE_GROUPS = [
  { durationS: 14, delayS: 0 },
  { durationS: 16.5, delayS: 2.2 },
  { durationS: 19, delayS: 4.7 },
  { durationS: 21.5, delayS: 1.3 },
  { durationS: 24, delayS: 3.6 },
  { durationS: 26, delayS: 5.9 },
];

interface Ember {
  index: number;
  cx: number;
  cy: number;
  r: number;
  fill: string;
}

/** Deterministic pseudo-jitter from the bucket index — encodes nothing. */
function jitterFor(index: number): number {
  const raw = Math.sin(index * 12.9898) * 43758.5453;
  const frac = raw - Math.floor(raw);
  const value = frac * 26 - 13;
  return Math.max(-13, Math.min(13, value));
}

function bucketMovement(variant: ActivityVariant): number[] {
  const samples = getMovementStream(variant).getWindow(24);
  const buckets = new Array(BUCKET_COUNT).fill(0) as number[];
  if (samples.length === 0) {
    return buckets;
  }
  // Anchor "now" to the stream's own latest sample rather than a separately
  // read clock, so the rightmost bucket lines up exactly with the data.
  const nowMs = samples[samples.length - 1].timestamp.getTime();
  for (const sample of samples) {
    if (!sample.moved) {
      continue;
    }
    const msAgo = nowMs - sample.timestamp.getTime();
    if (msAgo < 0) {
      continue;
    }
    const bucketFromEnd = Math.floor(msAgo / BUCKET_MS);
    const index = BUCKET_COUNT - 1 - bucketFromEnd;
    if (index >= 0 && index < BUCKET_COUNT) {
      buckets[index] += 1;
    }
  }
  return buckets.map((count) => Math.min(count, 3));
}

function emberFor(index: number, movedCount: number): Ember | null {
  if (movedCount <= 0) {
    return null;
  }
  const cx = 1.78 + index * 3.5625;
  const cy = VIEW_HEIGHT / 2 + jitterFor(index);
  if (movedCount === 1) {
    return { index, cx, cy, r: 1.1, fill: 'var(--lamp-3)' };
  }
  if (movedCount === 2) {
    return { index, cx, cy, r: 1.6, fill: 'var(--lamp-4)' };
  }
  return { index, cx, cy, r: 2.1, fill: 'var(--lamp-5)' };
}

export function EmberBand({ variant, onOpenLiveView }: EmberBandProps): ReactElement {
  const reduced = usePrefersReducedMotion();
  const styleId = useId().replace(/[^a-zA-Z0-9]/g, '');

  const embers = useMemo(() => {
    const buckets = bucketMovement(variant);
    const result: Ember[] = [];
    for (let i = 0; i < BUCKET_COUNT; i += 1) {
      const ember = emberFor(i, buckets[i]);
      if (ember) {
        result.push(ember);
      }
    }
    return result;
  }, [variant]);

  const groups = useMemo(() => {
    const byGroup: Ember[][] = [[], [], [], [], [], []];
    for (const ember of embers) {
      byGroup[ember.index % 6].push(ember);
    }
    return byGroup;
  }, [embers]);

  return (
    <div className="rounded-card bg-surface pt-[22px] px-4 pb-4">
      {!reduced && (
        <style>{`
          @keyframes ember-breath-${styleId} {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.92; }
          }
        `}</style>
      )}
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        width="100%"
        role="img"
        aria-label="Movement over the last 24 hours, shown as a scattering of marks — denser where you were moving, thin where you were not."
      >
        {groups.map((group, groupIndex) => {
          if (group.length === 0) {
            return null;
          }
          const phase = PHASE_GROUPS[groupIndex];
          const style = reduced
            ? undefined
            : {
                animation: `ember-breath-${styleId} ${phase.durationS}s var(--ease-breathe) infinite`,
                animationDelay: `${phase.delayS}s`,
              };
          return (
            <g key={groupIndex} style={style}>
              {group.map((ember) => (
                <circle key={ember.index} cx={ember.cx} cy={ember.cy} r={ember.r} fill={ember.fill} />
              ))}
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-micro text-text-muted">24 hours ago</span>
        <span className="text-micro text-text-muted">now</span>
      </div>

      <button
        type="button"
        onClick={onOpenLiveView}
        className="tap mt-6 flex w-full items-center justify-between gap-3 rounded-card bg-surface-hi px-4 text-label text-accent"
      >
        Open live view
        <ArrowUpRight size={20} weight="light" aria-hidden="true" />
      </button>
    </div>
  );
}
