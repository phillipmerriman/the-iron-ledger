-- What each skip changed in the plan (entries moved, added and removed), so undoing a skip
-- reverses exactly those changes and nothing else.
alter table public.skipped_days add column if not exists changes jsonb;
