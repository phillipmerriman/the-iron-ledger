-- Optional note on why the user skipped the day
alter table public.skipped_days add column if not exists reason text;
