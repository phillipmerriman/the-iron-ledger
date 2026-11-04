-- Days the user marked as skipped. activation_ids lists the active programs whose schedule was
-- pushed back by the skip, so undoing it can pull exactly those back.
create table if not exists public.skipped_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  activation_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists skipped_days_user_idx on public.skipped_days(user_id);

alter table public.skipped_days enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'skipped_days' and policyname = 'Users manage own skipped days'
  ) then
    create policy "Users manage own skipped days" on public.skipped_days
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
