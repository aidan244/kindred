-- Append-only audit log, enforced at the database level rather than
-- promised in application code. If anything ever goes wrong, this is the
-- artefact that has to be trustworthy independent of what the app did.

create or replace function reject_mutation() returns trigger
  language plpgsql as $$ begin
    raise exception 'audit_log is append-only';
  end $$;

create trigger audit_no_update before update on audit_log
  for each row execute function reject_mutation();
create trigger audit_no_delete before delete on audit_log
  for each row execute function reject_mutation();
