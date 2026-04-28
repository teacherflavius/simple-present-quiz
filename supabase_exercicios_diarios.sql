-- Tabela para registrar os exercícios diários concluídos pelos alunos
-- Execute no Supabase em SQL Editor > Run.

create table if not exists public.daily_exercise_completion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  exercise_title text not null,
  exercise_url text,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);

create index if not exists daily_exercise_completion_user_id_idx
  on public.daily_exercise_completion(user_id);

create index if not exists daily_exercise_completion_exercise_id_idx
  on public.daily_exercise_completion(exercise_id);

alter table public.daily_exercise_completion enable row level security;

drop policy if exists "Alunos podem ver seus exercícios diários" on public.daily_exercise_completion;
create policy "Alunos podem ver seus exercícios diários"
  on public.daily_exercise_completion
  for select
  using (auth.uid() = user_id);

drop policy if exists "Alunos podem inserir seus exercícios diários" on public.daily_exercise_completion;
create policy "Alunos podem inserir seus exercícios diários"
  on public.daily_exercise_completion
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Alunos podem atualizar seus exercícios diários" on public.daily_exercise_completion;
create policy "Alunos podem atualizar seus exercícios diários"
  on public.daily_exercise_completion
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_daily_exercise_completion_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_daily_exercise_completion_updated_at on public.daily_exercise_completion;
create trigger set_daily_exercise_completion_updated_at
before update on public.daily_exercise_completion
for each row
execute function public.set_daily_exercise_completion_updated_at();
