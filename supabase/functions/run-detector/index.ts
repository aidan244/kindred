/**
 * Runs the movement detector (src/lib/movement/detector.ts) against every
 * patient's recent data and fires an `alerts` row where it triggers.
 *
 * Imports the detector directly from the frontend/backend source tree
 * rather than re-implementing it — one implementation of the rule,
 * exercised by both a future in-app preview and this real scheduled job.
 * src/lib/movement/*.ts import each other with explicit `.ts` extensions
 * specifically so Deno can resolve them the same way Vite does; see the
 * Phase 3 plan for why that mattered.
 *
 * Intended to run on a schedule via `pg_cron` calling this function's URL
 * (the standard Supabase pattern: `select cron.schedule(...)` with
 * `net.http_post` against the deployed function). Not scheduled here —
 * nothing in this phase is applied to a live project. Can also be invoked
 * directly (e.g. for manual testing once deployed).
 *
 * Uses the service role key: only the detector — never a patient-role
 * client — should be able to write a real `alerts` row (see
 * src/lib/backend/supabaseBackend.ts's fireAlert() doc comment for the
 * other half of that boundary).
 */

import { detect } from '../../../src/lib/movement/detector.ts';
import { computeBaseline } from '../../../src/lib/movement/baseline.ts';
import type { MovementBin } from '../../../src/lib/movement/types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Baseline needs a rolling 7 days; one extra day of headroom.
const LOOKBACK_DAYS = 8;
// Gestation gating (held-backend-brief.md session_state_machine): below 28
// weeks the app runs self-report only, no detector. Duplicated in miniature
// from supabaseBackend.ts's gestationWeeksAt rather than imported, so this
// function's dependency graph stays inside src/lib/movement — importing
// supabaseBackend.ts would pull in frontend-coupled modules that were never
// made Deno-safe, for the sake of four lines of arithmetic.
const MIN_DETECTOR_GESTATION_WEEKS = 28;

function gestationWeeksAt(edd: Date, now: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilDue = Math.round((edd.getTime() - now.getTime()) / msPerDay);
  return Math.max(0, Math.floor((280 - daysUntilDue) / 7));
}

interface PatientRow {
  id: string;
  edd: string;
}

interface MovementBinRow {
  t: string;
  active_windows: number;
  covered_windows: number;
}

interface AlertRow {
  fired_at: string;
}

interface SessionRow {
  id: string;
}

async function restRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY as string,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase REST ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

function rowsToBins(rows: MovementBinRow[]): MovementBin[] {
  return rows.map((row) => ({
    t: new Date(row.t),
    activeWindows: row.active_windows,
    coveredWindows: row.covered_windows,
  }));
}

Deno.serve(async (_req: Request) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const patients = (await restRequest('/rest/v1/patients?select=id,edd')) as PatientRow[];
  const results: Array<{ patientId: string; fired: boolean; skipped?: string }> = [];

  for (const patient of patients) {
    if (gestationWeeksAt(new Date(patient.edd), now) < MIN_DETECTOR_GESTATION_WEEKS) {
      results.push({ patientId: patient.id, fired: false, skipped: 'below gestation gate' });
      continue;
    }

    const binRows = (await restRequest(
      `/rest/v1/movement_bins?patient_id=eq.${patient.id}&t=gte.${since.toISOString()}&order=t.asc`
    )) as MovementBinRow[];
    const bins = rowsToBins(binRows);
    const baseline = computeBaseline(bins, now);

    // Refractory period is measured from the last alert regardless of
    // whether it's since been acknowledged — matching
    // src/lib/movement/detector.ts's own semantics.
    const lastAlertRows = (await restRequest(
      `/rest/v1/alerts?patient_id=eq.${patient.id}&order=fired_at.desc&limit=1`
    )) as AlertRow[];
    const lastAlertAt = lastAlertRows.length > 0 ? new Date(lastAlertRows[0].fired_at) : null;

    const openSessions = (await restRequest(
      `/rest/v1/sessions?patient_id=eq.${patient.id}&completed_at=is.null&select=id`
    )) as SessionRow[];

    const firing = detect(bins, baseline, now, {
      lastAlertAt,
      sessionOpen: openSessions.length > 0,
    });

    if (firing) {
      await restRequest('/rest/v1/alerts', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          patient_id: patient.id,
          detector_version: firing.detectorVersion,
          rule: firing.rule,
          window_from: firing.windowFrom.toISOString(),
          window_to: firing.windowTo.toISOString(),
          coverage_fraction: firing.coverageFraction,
          observed: firing.observed,
          expected: firing.expected,
          threshold: firing.threshold,
        }),
      });
    }

    results.push({ patientId: patient.id, fired: firing !== null });
  }

  return new Response(
    JSON.stringify({
      checked: results.length,
      fired: results.filter((r) => r.fired).length,
      results,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
});
