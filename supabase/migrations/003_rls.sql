-- Row-level security on all eleven tables, enabled in the same migration
-- that creates them (001_core.sql already ran; this is the very next one,
-- not a later bolt-on).
--
-- Two roles matter: the patient (an authenticated app user), and clinic
-- staff (provisional — see clinic_staff in 001_core.sql). A patient sees
-- only her own rows. Clinic staff see sessions and reports for patients
-- registered to their clinic (unqualified, per the brief); raw
-- movement_bins/baselines additionally require that the patient has at
-- least one session with that clinic — approximated here as "has any
-- session row at all", the closest available proxy to "has contacted the
-- clinic" in this schema. Flagged as provisional, same as clinic_staff
-- itself, pending the clinician queue feature that would actually exercise
-- these policies.
--
-- Safeguarding flags get no patient policy at all, on purpose: RLS enabled
-- with zero policies for the patient role is default-deny, which is
-- exactly what "never joined into any query that reaches the app" (rule 6)
-- requires. There's no reviewer role or UI in this build to grant a policy
-- to yet — adding one now would be guessing at an access model nothing
-- exercises.

alter table clinics             enable row level security;
alter table patients            enable row level security;
alter table movement_bins       enable row level security;
alter table baselines           enable row level security;
alter table alerts              enable row level security;
alter table sessions            enable row level security;
alter table red_flag_answers    enable row level security;
alter table self_reports        enable row level security;
alter table reports             enable row level security;
alter table audit_log           enable row level security;
alter table safeguarding_flags  enable row level security;
alter table clinic_staff        enable row level security;

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------

create policy patient_self on patients
  for select using (auth_user_id = auth.uid());

create policy clinic_staff_read_patients on patients
  for select using (exists (
    select 1 from clinic_staff cs
    where cs.clinic_id = patients.clinic_id and cs.auth_user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- clinics — a patient needs her own clinic's name/hours/triage number to
-- resolve getTriageContact(); clinic staff need their own clinic's row.
-- ---------------------------------------------------------------------------

create policy patient_own_clinic on clinics
  for select using (exists (
    select 1 from patients p
    where p.clinic_id = clinics.id and p.auth_user_id = auth.uid()
  ));

create policy clinic_staff_own_clinic on clinics
  for select using (exists (
    select 1 from clinic_staff cs
    where cs.clinic_id = clinics.id and cs.auth_user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- movement_bins / baselines — patient reads her own; clinic staff read only
-- for a patient who has actually contacted them (approximated: has any
-- session row).
-- ---------------------------------------------------------------------------

create policy movement_own on movement_bins
  for select using (exists (
    select 1 from patients p
    where p.id = movement_bins.patient_id and p.auth_user_id = auth.uid()
  ));

create policy clinic_staff_movement_of_contacted_patients on movement_bins
  for select using (exists (
    select 1 from patients p
    join clinic_staff cs on cs.clinic_id = p.clinic_id
    where p.id = movement_bins.patient_id
      and cs.auth_user_id = auth.uid()
      and exists (select 1 from sessions s where s.patient_id = p.id)
  ));

create policy baseline_own on baselines
  for select using (exists (
    select 1 from patients p
    where p.id = baselines.patient_id and p.auth_user_id = auth.uid()
  ));

create policy clinic_staff_baseline_of_contacted_patients on baselines
  for select using (exists (
    select 1 from patients p
    join clinic_staff cs on cs.clinic_id = p.clinic_id
    where p.id = baselines.patient_id
      and cs.auth_user_id = auth.uid()
      and exists (select 1 from sessions s where s.patient_id = p.id)
  ));

-- ---------------------------------------------------------------------------
-- alerts — patient can read and acknowledge her own alert, but not create
-- or delete one. A real alert is only ever inserted by the detector
-- (supabase/functions/run-detector, via the service role key), never by a
-- patient-role client — see supabaseBackend.ts for why fireAlert() is not
-- expected to succeed here under RLS.
-- ---------------------------------------------------------------------------

create policy alert_own_read on alerts
  for select using (exists (
    select 1 from patients p
    where p.id = alerts.patient_id and p.auth_user_id = auth.uid()
  ));

create policy alert_own_acknowledge on alerts
  for update using (exists (
    select 1 from patients p
    where p.id = alerts.patient_id and p.auth_user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- sessions — patient creates/reads/updates her own (createSession,
-- completeSession); clinic staff read sessions for patients registered to
-- their clinic (unqualified, per the brief).
-- ---------------------------------------------------------------------------

create policy sessions_own on sessions
  for all using (exists (
    select 1 from patients p
    where p.id = sessions.patient_id and p.auth_user_id = auth.uid()
  ));

create policy clinic_staff_sessions on sessions
  for select using (exists (
    select 1 from patients p
    join clinic_staff cs on cs.clinic_id = p.clinic_id
    where p.id = sessions.patient_id and cs.auth_user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- red_flag_answers / self_reports — scoped through session ownership.
-- ---------------------------------------------------------------------------

create policy red_flag_answers_own on red_flag_answers
  for all using (exists (
    select 1 from sessions s
    join patients p on p.id = s.patient_id
    where s.id = red_flag_answers.session_id and p.auth_user_id = auth.uid()
  ));

create policy clinic_staff_red_flag_answers on red_flag_answers
  for select using (exists (
    select 1 from sessions s
    join patients p on p.id = s.patient_id
    join clinic_staff cs on cs.clinic_id = p.clinic_id
    where s.id = red_flag_answers.session_id and cs.auth_user_id = auth.uid()
  ));

create policy self_reports_own on self_reports
  for all using (exists (
    select 1 from sessions s
    join patients p on p.id = s.patient_id
    where s.id = self_reports.session_id and p.auth_user_id = auth.uid()
  ));

create policy clinic_staff_self_reports on self_reports
  for select using (exists (
    select 1 from sessions s
    join patients p on p.id = s.patient_id
    join clinic_staff cs on cs.clinic_id = p.clinic_id
    where s.id = self_reports.session_id and cs.auth_user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- reports — patient reads/creates her own (storeReport); clinic staff read
-- reports for patients registered to their clinic (unqualified, per the
-- brief — this is the whole point of the table).
-- ---------------------------------------------------------------------------

create policy reports_own on reports
  for all using (exists (
    select 1 from sessions s
    join patients p on p.id = s.patient_id
    where s.id = reports.session_id and p.auth_user_id = auth.uid()
  ));

create policy clinic_staff_reports on reports
  for select using (exists (
    select 1 from sessions s
    join patients p on p.id = s.patient_id
    join clinic_staff cs on cs.clinic_id = p.clinic_id
    where s.id = reports.session_id and cs.auth_user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- audit_log — insert-only for a patient, scoped to her own patient_id, no
-- select/update/delete. A more hardened design would route audit writes
-- through a service-role edge function instead of trusting the
-- patient-role client to log honestly; that's a reasonable hardening step
-- for a real pilot, not done here.
-- ---------------------------------------------------------------------------

create policy audit_insert_own on audit_log
  for insert with check (
    patient_id is null or exists (
      select 1 from patients p
      where p.id = audit_log.patient_id and p.auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- clinic_staff — a staff member can see their own mapping row. Nothing
-- else reads or writes this table from the client in this build.
-- ---------------------------------------------------------------------------

create policy clinic_staff_self on clinic_staff
  for select using (auth_user_id = auth.uid());

-- safeguarding_flags: intentionally no policies at all (see file header).
