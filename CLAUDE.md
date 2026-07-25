# CLAUDE.md

Conventions for anyone (human or Claude Code) working on this repo. Read this before touching
anything under `/src/lib/backend`, `/supabase`, or any patient-facing string anywhere in the app.

## What this repo is

`kindred` is Held: a pregnancy movement monitoring and triage app for private maternity clinics.
The frontend (everything outside `/src/lib/backend` and `/supabase`) was built from
`held-build-brief.md` and is considered feature-complete and visually locked — its design system
is documented in `design-plan.md` and is expected to be **replaced later**, but its **connectors**
(`src/types.ts`, `src/sensors/MovementStream.ts`, `src/logic/disposition.ts`,
`src/logic/triageContact.ts`, `ReportData`) are the durable contract and must not change shape
without an explicit conversation first.

The backend (`/src/lib/backend`, `/supabase`) is being added from `held-backend-brief.md`, adapted
to plug into the frontend's real interfaces rather than the ones that brief speculatively sketched.
See the reconciliation note at the top of each phase's plan file for the specifics of what changed
and why.

## Clinical safety rules — non-negotiable, override everything else

These are already enforced throughout the existing frontend (`design-plan.md` §0 and §10,
`src/data/clinicalContent.ts`, `src/logic/reportPdf.ts`, `src/logic/disposition.ts`,
`src/logic/triageContact.ts`). Any new backend code must not violate them, and any new
patient-facing string must be checked against them before it ships:

1. **No verdict, ever.** No wellbeing judgement, no risk score, no green state, no "normal", no
   reassuring tick. The system shows data and offers actions; it never concludes.
2. **Her perception always wins.** A self-reported concern escalates regardless of what the
   sensor shows. The sensor is never shown as a counterargument, in the app or in any report.
3. **Escalation destination is maternity triage, not A&E.** The word "A&E" must never appear in
   any patient-facing surface or generated document. The screen says *call*, not *attend* — a
   human clinician decides attendance.
4. **Quiet data is not a quiet baby.** An absence of sensor coverage must never render as
   stillness, in any query, chart, or document. (The current frontend's `ActivitySample` type
   doesn't carry a coverage field — see the Phase 1 plan's reconciliation note for how the
   backend handles this without changing that type.)
5. **Movement data never determines disposition.** Disposition comes only from entry path and
   red-flag answers, through `src/logic/disposition.ts` — reuse it, never reimplement or
   duplicate the rule.
6. **Safeguarding routing is invisible to the patient** and requires human review before any
   action is taken on it.

The word **"detected"** also never appears on any patient-facing surface (see
`src/data/clinicalContent.ts`'s alert framing copy) — alerts and copy lead with the action, not a
diagnostic assertion.

## Naming and code conventions

- Reuse existing types from `src/types.ts` rather than redefining overlapping shapes in
  `src/lib/backend/*`. New backend-only concepts (e.g. `Session`, `Alert`, persisted report
  records) get their own types in `src/lib/backend/types.ts`, importing what already exists.
- `disposition()` and `getTriageContact()` have exactly one implementation, in
  `src/logic/disposition.ts` / `src/logic/triageContact.ts`. Backend code imports and calls them;
  it does not re-derive the rule.
- Every external dependency (Supabase, an LLM call, push delivery) sits behind an interface with a
  deterministic local/mock fallback, selected once at startup via `VITE_BACKEND`
  (`mock` | `supabase`). The demo must always run on `mock` with zero network calls.
- Magic constants derived from external evidence (sensor error rates, timing windows, etc.) carry
  a source comment.
- Work proceeds in the four phases defined in `held-backend-brief.md`'s `<process>` section, each
  planned and shown before code is written. Do not skip ahead to a later phase's scope.

## Environment

See `.env.local.example` for the variable list. `.env.local` itself is never committed.
