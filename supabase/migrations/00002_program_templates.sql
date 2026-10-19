-- Program templates: template type/config on programs, progression state on activations,
-- and a log of program completions.
-- NOTE: 00001 has drifted from the live schema (program_activations was created outside
-- this repo), so everything here is idempotent. Verify against the live DB before applying.

alter table public.programs
  add column if not exists template_type text not null default 'basic'
    check (template_type in ('basic', 'wildman_reverse_ladder')),
  add column if not exists template_config jsonb;

-- Create program_activations only if it's missing (with RLS + owner policy).
-- An existing table and its RLS settings are left alone.
do $$
begin
  if to_regclass('public.program_activations') is null then
    create table public.program_activations (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      program_id uuid not null references public.programs(id) on delete cascade,
      start_date date not null,
      created_at timestamptz not null default now()
    );
    alter table public.program_activations enable row level security;
    create policy "Users manage own program activations" on public.program_activations
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

alter table public.program_activations
  add column if not exists progress jsonb;

create table if not exists public.program_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  activation_id uuid not null,
  exercise_id uuid references public.exercises(id) on delete set null,
  weight numeric,
  weight_unit text not null default 'lbs' check (weight_unit in ('lbs', 'kg', 'pood', 'bodyweight')),
  outcome text not null check (outcome in ('restart', 'complete')),
  completed_at timestamptz not null default now()
);

create index if not exists program_completions_user_idx on public.program_completions(user_id);

alter table public.program_completions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'program_completions' and policyname = 'Users manage own program completions'
  ) then
    create policy "Users manage own program completions" on public.program_completions
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
