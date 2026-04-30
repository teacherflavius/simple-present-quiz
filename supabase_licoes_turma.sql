-- Registro de frequência por lições L1 a L74 nas turmas.
-- Execute no Supabase em SQL Editor > Run.
-- Este arquivo complementa supabase_turmas.sql.

create table if not exists public.class_lesson_records (
  id uuid primary key default gen_random_uuid(),
  class_number integer not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  class_date date not null,
  lesson_code text not null check (lesson_code ~ '^L([1-9]|[1-6][0-9]|7[0-4])$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_number, user_id, class_date)
);

create index if not exists class_lesson_records_class_number_idx
  on public.class_lesson_records(class_number);

create index if not exists class_lesson_records_user_id_idx
  on public.class_lesson_records(user_id);

create index if not exists class_lesson_records_class_date_idx
  on public.class_lesson_records(class_date desc);

alter table public.class_lesson_records enable row level security;

drop policy if exists "Professores podem gerenciar registros de lições" on public.class_lesson_records;
create policy "Professores podem gerenciar registros de lições"
  on public.class_lesson_records
  for all
  using (public.is_teacher_admin())
  with check (public.is_teacher_admin());

drop policy if exists "Alunos podem visualizar seus registros de lições" on public.class_lesson_records;
create policy "Alunos podem visualizar seus registros de lições"
  on public.class_lesson_records
  for select
  using (auth.uid() = user_id);

drop trigger if exists set_class_lesson_records_updated_at on public.class_lesson_records;
create trigger set_class_lesson_records_updated_at
before update on public.class_lesson_records
for each row
execute function public.set_updated_at();

create or replace function public.get_teacher_class_lesson_records(target_class_number integer)
returns table (
  id text,
  class_number integer,
  user_id text,
  class_date date,
  lesson_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_teacher_admin() then
    raise exception 'Acesso negado: usuário não cadastrado como professor.';
  end if;

  perform public.assert_teacher_class_exists(target_class_number);

  return query
  select
    clr.id::text,
    clr.class_number,
    clr.user_id::text,
    clr.class_date,
    clr.lesson_code,
    clr.created_at,
    clr.updated_at
  from public.class_lesson_records clr
  where clr.class_number = target_class_number
  order by clr.class_date desc, clr.created_at desc;
end;
$$;

grant execute on function public.get_teacher_class_lesson_records(integer) to authenticated;

create or replace function public.save_teacher_class_lesson_record(
  target_class_number integer,
  target_user_id uuid,
  target_class_date date,
  target_lesson_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_teacher_admin() then
    raise exception 'Acesso negado: usuário não cadastrado como professor.';
  end if;

  perform public.assert_teacher_class_exists(target_class_number);

  if target_lesson_code !~ '^L([1-9]|[1-6][0-9]|7[0-4])$' then
    raise exception 'Lição inválida. Use valores de L1 a L74.';
  end if;

  if not exists (
    select 1 from public.class_students cs
    where cs.class_number = target_class_number
      and cs.user_id = target_user_id
  ) then
    raise exception 'Este aluno não pertence a esta turma.';
  end if;

  insert into public.class_lesson_records (
    class_number,
    user_id,
    class_date,
    lesson_code
  )
  values (
    target_class_number,
    target_user_id,
    target_class_date,
    target_lesson_code
  )
  on conflict (class_number, user_id, class_date) do update
  set lesson_code = excluded.lesson_code;

  return jsonb_build_object(
    'ok', true,
    'class_number', target_class_number,
    'user_id', target_user_id,
    'class_date', target_class_date,
    'lesson_code', target_lesson_code
  );
end;
$$;

grant execute on function public.save_teacher_class_lesson_record(integer, uuid, date, text) to authenticated;
