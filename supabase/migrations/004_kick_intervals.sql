-- Kick-count storage — added alongside the frontend's move from a heart-rate
-- channel to kick tallies (src/sensors/MovementStream.ts's getDailyKickWindow
-- / getHourlyKickWindow / getTrendKickWindow). RLS enabled in this same
-- migration, same principle as 001_core.sql/003_rls.sql: never bolted on
-- later.
--
-- ONE TABLE, TWO INTERVAL KINDS, not four separate tables for the four
-- windows the app reads. All three kick windows (daily/7, hourly/12,
-- trend/84) are the same shape of question — "the most recent N intervals of
-- this kind, oldest first" — against the same two interval kinds ('day' for
-- daily and trend, 'hour' for hourly); they differ only in LIMIT, which is
-- application logic, not schema.
--
-- A row's kicks value is a TALLY OVER THE INTERVAL, not a reading at an
-- instant (src/data/seedKicks.ts's header makes the same point about the
-- mock data) — so the row for an interval that has not finished yet (today,
-- or the current hour) necessarily holds a partial count. That is true of
-- any real ingest pipeline that upserts a running tally as kicks arrive
-- during the interval, not just the mock: the caller is responsible for
-- treating the newest row as unsettled (samples.length - 2), exactly as
-- MockMovementStream's kickWindow() does — see supabaseMovementStream.ts.
create table kick_intervals (
  patient_id uuid not null references patients(id) on delete cascade,
  interval_start timestamptz not null,          -- start of the interval, matches KickSample.timestamp
  interval_kind text not null check (interval_kind in ('hour', 'day')),
  kicks smallint not null check (kicks >= 0),
  primary key (patient_id, interval_kind, interval_start)
);

-- Supports "most recent N intervals of this kind for this patient" directly:
-- where patient_id = ? and interval_kind = ? order by interval_start desc limit N.
create index kick_intervals_recent on kick_intervals (patient_id, interval_kind, interval_start desc);

alter table kick_intervals enable row level security;

-- Same shape as movement_own / clinic_staff_movement_of_contacted_patients in
-- 003_rls.sql: patient reads her own; clinic staff read only for a patient
-- who has actually contacted them (approximated: has any session row).
create policy kick_intervals_own on kick_intervals
  for select using (exists (
    select 1 from patients p
    where p.id = kick_intervals.patient_id and p.auth_user_id = auth.uid()
  ));

create policy clinic_staff_kick_intervals_of_contacted_patients on kick_intervals
  for select using (exists (
    select 1 from patients p
    join clinic_staff cs on cs.clinic_id = p.clinic_id
    where p.id = kick_intervals.patient_id
      and cs.auth_user_id = auth.uid()
      and exists (select 1 from sessions s where s.patient_id = p.id)
  ));
