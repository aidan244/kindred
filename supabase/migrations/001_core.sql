-- Core schema for Held/Kindred. Health data — every table gets row-level
-- security enabled in 003_rls.sql, in a migration that ships alongside this
-- one, never bolted on later.
--
-- Column shapes are reconciled against the actual TypeScript types the app
-- and backend seam use (src/types.ts, src/lib/backend/types.ts,
-- src/lib/movement/types.ts) rather than re-derived from scratch. Where a
-- table carries a field with no equivalent in a TS type (e.g. patient_id on
-- rows the client never needs to see it on, since RLS already scopes the
-- row to auth.uid()), that's intentional — the DB row is not required to
-- mirror the client-side type 1:1.

create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  triage_phone text not null,
  report_email text not null,
  opening_hours jsonb not null,   -- { mon: ["08:00","18:00"], ... sun: null }
  created_at timestamptz not null default now()
);

create table patients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  clinic_id uuid not null references clinics(id),
  full_name text not null,
  date_of_birth date not null,
  clinic_reference text,               -- appears on every page of the PDF
  edd date not null,                   -- gestation is derived, never stored stale
  booked_maternity_unit text not null, -- the 24/7 fallback
  booked_unit_phone text not null,
  emergency_contact_name text,
  emergency_contact_phone text,
  onboarding_history jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Mirrors src/lib/movement/types.ts MovementBin exactly: t/active_windows/
-- covered_windows. covered_windows = 0 means no data, never a stillness
-- reading (clinical safety rule 4) — enforced by application logic
-- (aggregate.ts, features.ts), not by a DB constraint, since the DB has no
-- way to know what "the app never reads this as stillness" means.
create table movement_bins (
  patient_id uuid not null references patients(id) on delete cascade,
  t timestamptz not null,              -- 5-minute aligned bin start
  active_windows smallint not null check (active_windows between 0 and 75),
  covered_windows smallint not null check (covered_windows between 0 and 75),
  primary key (patient_id, t)
);
create index movement_bins_recent on movement_bins (patient_id, t desc);

-- Mirrors src/lib/movement/types.ts Baseline exactly.
create table baselines (
  patient_id uuid primary key references patients(id) on delete cascade,
  computed_at timestamptz not null,
  days_used smallint not null,
  sufficient boolean not null,
  by_hour jsonb not null               -- 24 HourlyBaseline entries
);

-- `rule` accepts a third value, 'manual_demo', beyond the two real detector
-- rules (src/lib/movement/types.ts DetectorRule). This is a deliberate,
-- documented deviation from a schema that otherwise assumes every alert
-- comes from the detector: the frontend's demo panel already ships a
-- manual "fire push notification" button with no detector measurement
-- behind it (see src/components/DemoPanel.tsx), and HeldBackend.fireAlert()
-- exists to serve exactly that button. Faking plausible detector numbers
-- for a manual press would be dishonest; a distinct rule value plus
-- nullable measurement columns is the honest alternative.
create table alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  fired_at timestamptz not null default now(),
  detector_version text not null,
  rule text not null check (rule in ('sustained_low_rate','extended_quiet','manual_demo')),
  window_from timestamptz,
  window_to timestamptz,
  coverage_fraction numeric(4,3),
  observed numeric,
  expected numeric,
  threshold numeric,
  acknowledged_at timestamptz,
  outcome text check (outcome in
    ('session_started','dismissed','unacknowledged','unacknowledged_out_of_hours'))
);

-- Mirrors src/lib/backend/types.ts Session, plus patient_id (which the
-- client never needs back on the Session object itself — RLS already
-- scopes every row to auth.uid(), so the mapper in supabaseBackend.ts
-- doesn't round-trip this column into the TS type).
create table sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  alert_id uuid references alerts(id),
  entry_path text not null check (entry_path in ('alert','adhoc')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  disposition text check (disposition in ('escalate','routine')),
  triage_contact_shown jsonb            -- exactly what she saw, for the audit trail
);

create table red_flag_answers (
  session_id uuid not null references sessions(id) on delete cascade,
  question_id text not null,
  question_text text not null,          -- denormalised: the wording at the time
  answer boolean not null,
  detail text,
  primary key (session_id, question_id)
);

create table self_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  captured_at timestamptz not null default now(),
  raw_text text not null,
  input_mode text not null check (input_mode in ('voice','text')),
  structured jsonb                      -- structure-free-text edge function output
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references sessions(id) on delete cascade,
  generated_at timestamptz not null default now(),
  storage_path text,                    -- supabase storage, canonical copy
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending','sent','failed','acknowledged')),
  delivery_attempts smallint not null default 0,
  delivered_at timestamptz
);

create table audit_log (
  id bigserial primary key,
  patient_id uuid references patients(id) on delete set null,
  at timestamptz not null default now(),
  event text not null,
  detail jsonb not null default '{}'::jsonb,
  rule_set_version text
);

-- Never read by the patient-facing app, never joined into any query that
-- reaches it (clinical safety rule 6) — enforced in 003_rls.sql by simply
-- never granting the patient role a policy on this table at all.
create table safeguarding_flags (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  raised_at timestamptz not null default now(),
  classification text not null,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  action_taken text
);

-- Provisional: maps a clinic staff member's auth user to the clinic they
-- work at. This is the minimum needed for the clinic-staff RLS policies in
-- 003_rls.sql to mean anything. It is NOT a finished access-control design
-- — there's no clinician-facing UI in this build (that's Tier 2 #10 in
-- held-backend-integrations.md, explicitly out of scope), so there's
-- nothing yet that provisions rows here or handles clinic-staff sign-up.
-- Finalise this alongside that feature, not before.
create table clinic_staff (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid not null references clinics(id),
  created_at timestamptz not null default now()
);
