-- Tabela para registros de frequência dos alunos
-- Execute este arquivo no Supabase em SQL Editor > Run.

create table if not exists public.student_frequency (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_date date not null,
  attendance_status text not null check (attendance_status in ('Compareceu', 'Faltou')),
  class_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_frequency_user_id_idx
  on public.student_frequency(user_id);

create index if not exists student_frequency_class_date_idx
  on public.student_frequency(class_date desc);

alter table public.student_frequency enable row level security;

-- O aluno logado pode ver apenas seus próprios registros.
drop policy if exists "Alunos podem ver sua própria frequência" on public.student_frequency;
create policy "Alunos podem ver sua própria frequência"
  on public.student_frequency
  for select
  using (auth.uid() = user_id);

-- Permite inserir registro para o próprio usuário logado.
-- Observação: para um painel administrativo real do professor, o ideal é criar uma role/admin.
drop policy if exists "Usuários podem inserir sua própria frequência" on public.student_frequency;
create policy "Usuários podem inserir sua própria frequência"
  on public.student_frequency
  for insert
  with check (auth.uid() = user_id);

-- Permite atualizar apenas registros do próprio usuário logado.
drop policy if exists "Usuários podem atualizar sua própria frequência" on public.student_frequency;
create policy "Usuários podem atualizar sua própria frequência"
  on public.student_frequency
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Permite apagar apenas registros do próprio usuário logado.
drop policy if exists "Usuários podem apagar sua própria frequência" on public.student_frequency;
create policy "Usuários podem apagar sua própria frequência"
  on public.student_frequency
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_student_frequency_updated_at on public.student_frequency;
create trigger set_student_frequency_updated_at
before update on public.student_frequency
for each row
execute function public.set_updated_at();
