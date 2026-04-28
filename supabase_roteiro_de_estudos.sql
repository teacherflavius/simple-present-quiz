-- Tabela para registrar as lições concluídas no Roteiro de Estudos
-- Execute no Supabase em SQL Editor > Run.

create table if not exists public.study_roadmap_completion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  lesson_number integer not null check (lesson_number between 1 and 24),
  lesson_title text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index if not exists study_roadmap_completion_user_id_idx
  on public.study_roadmap_completion(user_id);

create index if not exists study_roadmap_completion_lesson_id_idx
  on public.study_roadmap_completion(lesson_id);

alter table public.study_roadmap_completion enable row level security;

drop policy if exists "Alunos podem ver suas lições do roteiro" on public.study_roadmap_completion;
create policy "Alunos podem ver suas lições do roteiro"
  on public.study_roadmap_completion
  for select
  using (auth.uid() = user_id);

drop policy if exists "Alunos podem inserir suas lições do roteiro" on public.study_roadmap_completion;
create policy "Alunos podem inserir suas lições do roteiro"
  on public.study_roadmap_completion
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Alunos podem atualizar suas lições do roteiro" on public.study_roadmap_completion;
create policy "Alunos podem atualizar suas lições do roteiro"
  on public.study_roadmap_completion
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_study_roadmap_completion_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_study_roadmap_completion_updated_at on public.study_roadmap_completion;
create trigger set_study_roadmap_completion_updated_at
before update on public.study_roadmap_completion
for each row
execute function public.set_study_roadmap_completion_updated_at();
