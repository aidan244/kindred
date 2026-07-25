# Verification runbook — run this once a real Supabase project exists

Everything in this file requires a live Postgres instance with real
authenticated users. None of it has been run — Phase 3 of the backend work
was built with no Supabase CLI and no project credentials on the machine
that wrote it, by explicit choice (write the code, don't apply it). This
is the checklist for whoever applies the migrations for real.

## 0. Apply the migrations

```
supabase db push
# or, via the SQL editor, run 001_core.sql, 002_audit_immutable.sql,
# 003_rls.sql in that exact order
```

Seed at minimum: one row in `clinics`, one row in `patients` linked to a
real `auth.users` row (sign up two test users for step 2), a few
`movement_bins` rows for that patient.

## 1. RLS actually blocks a cross-patient read

This is the test the backend brief calls out by name as the one to demo if
anyone asks.

1. Sign up two users, A and B, each with their own `patients` row.
2. Insert a `movement_bins` row for patient A.
3. As user B (using B's JWT via the anon client, not the service role key),
   run: `select * from movement_bins where patient_id = '<patient A id>';`
4. **Expected: zero rows.** Not an error — RLS silently filters, which is
   correct — but confirm it's actually zero, not "returns A's data because
   a policy is misconfigured."
5. Repeat for `sessions`, `red_flag_answers`, `self_reports`, `reports`,
   `alerts`, `baselines`. Confirm zero rows for all of them as user B.
6. As user B, attempt `select * from safeguarding_flags;` — expect either
   zero rows or a permission error. There is no policy granting the patient
   role access to this table at all (003_rls.sql), so this should be the
   easiest one to confirm.

## 2. `audit_log` rejects UPDATE and DELETE

```sql
insert into audit_log (event, detail) values ('test', '{}');
update audit_log set event = 'tampered' where event = 'test';
-- expect: ERROR:  audit_log is append-only
delete from audit_log where event = 'test';
-- expect: ERROR:  audit_log is append-only
```

## 3. `VITE_BACKEND=mock` vs `VITE_BACKEND=supabase` parity

1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
2. Sign in as a test patient (requires building the login screen this
   backend pass didn't build — see `SupabaseBackend.create()`'s doc
   comment).
3. Set `VITE_BACKEND=supabase`, restart the dev server, and walk the same
   path as the mock-backend demo: fire an alert (or seed one directly via
   SQL, since `SupabaseBackend.fireAlert()` is expected to fail under RLS —
   see its doc comment), start a check-in, answer red flags, submit, and
   confirm the outcome screen renders identically to the mock path.
4. Confirm the report downloads and that `reports.storage_path` in the DB
   points at a real object in the `reports` storage bucket.

## 4. Edge functions

Both need `ANTHROPIC_API_KEY` set as a function secret
(`supabase secrets set ANTHROPIC_API_KEY=...`), never as a `VITE_` variable.

- `structure-free-text`: `curl -X POST <function-url> -d '{"rawText": "I noticed less movement this afternoon", "referenceTimestamp": "2026-01-01T15:00:00Z"}'` — confirm the response is valid JSON matching the schema in the function, and that it contains neither "detected" nor a diagnosis/risk-level word.
- `safeguarding-classify`: same shape, confirm a 204 with no body on both the `none` case and the flagged case — the response must never carry the classification back to the caller.
- `run-detector`: deploy, then invoke directly (`curl -X POST <function-url>`) against a patient with ≥5 days of ≥60%-covered seed data and a genuine sustained drop in the most recent hours. Confirm it inserts an `alerts` row with `rule = 'sustained_low_rate'` or `'extended_quiet'`. This is also where to confirm the `.ts`-extension import from `src/lib/movement/detector.ts` actually resolves under the deployed Edge Runtime's Deno version — if it doesn't, the fix is adding `.ts` extensions to whichever import Deno rejects (they're already added throughout `src/lib/movement/*.ts` for exactly this reason, so a failure here means something upstream of that changed).
- Schedule `run-detector` for real: `select cron.schedule('run-detector', '*/15 * * * *', $$ select net.http_post('<function-url>', headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb) $$);` — not done in this phase, since nothing is scheduled against a project that doesn't exist yet.

## 5. Sensitivity/error-model tests (already passing, no live dependency)

The two Vitest checks the backend brief calls out as the pair to demo if
challenged — the sensitivity round-trip and the RLS cross-patient test —
are asymmetric: the sensitivity round-trip (`src/test/movementGenerator.test.ts`)
already runs and passes with `npm test`, no live project needed. The RLS
one is step 1 above; there's no way to make it runnable without a real
database, which is exactly why it's the one written up here instead.
