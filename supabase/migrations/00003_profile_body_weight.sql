-- Approximate body weight on the profile (used for program weight guidance)
alter table public.profiles
  add column if not exists body_weight numeric,
  add column if not exists body_weight_unit text not null default 'lbs'
    check (body_weight_unit in ('lbs', 'kg'));
