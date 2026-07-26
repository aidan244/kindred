-- Extends alerts.rule to accept the kick-channel detector's rule value,
-- alongside the two boolean-channel rules and 'manual_demo' (001_core.sql).
-- Purely additive: widens the existing CHECK constraint, changes no data,
-- adds no column — DetectorFiring's shape is unchanged
-- (src/lib/movement/types.ts), so every existing alerts column already
-- fits a kick-channel firing (src/lib/movement/kickDetector.ts).
--
-- alerts_rule_check is Postgres's default auto-generated name for the
-- unnamed inline `check (rule in (...))` in 001_core.sql
-- (`{table}_{column}_check`, and 'rule' carries only the one inline check
-- there). Verify against the live schema
-- (`select conname from pg_constraint where conrelid = 'alerts'::regclass`)
-- before applying to a real project — nothing in this migration series has
-- been applied to one yet.

alter table alerts drop constraint if exists alerts_rule_check;
alter table alerts add constraint alerts_rule_check
  check (rule in ('sustained_low_rate', 'extended_quiet', 'manual_demo', 'reduced_kick_rate'));
