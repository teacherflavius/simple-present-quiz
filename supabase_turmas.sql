-- Tabela e funções para gerenciar alunos nas turmas
-- Execute no Supabase em SQL Editor > Run.
-- Este arquivo pressupõe que teacher_admins e profiles já existem.

create table if not exists public.teacher_classes (
  id uuid primary key default gen_random_uuid(),
  class_number integer unique not null,
  class_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_students (
  id uuid primary key default gen_random_uuid(),
  class_number integer not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_number, user_id)
);

create table if not exists public.class_resources (
  id uuid primary key default gen_random_uuid(),
  class_number integer not null unique,
  video_lesson_url text,
  lesson_material_url text,
  whatsapp_group_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Remove limites antigos de 1 a 45, caso tenham sido criados em versões anteriores.
do $$
begin
  alter table public.class_students drop constraint if exists class_students_class_number_check;
  alter table public.class_resources drop constraint if exists class_resources_class_number_check;
exception when others then
  null;
end $$;

insert into public.teacher_classes (class_number, class_name, is_active)
select n, 'Turma ' || n, true
from generate_series(1, 45) as n
on conflict (class_number) do nothing;

insert into public.teacher_classes (class_number, class_name, is_active)
select distinct cs.class_number, 'Turma ' || cs.class_number, true
from public.class_students cs
on conflict (class_number) do nothing;

insert into public.teacher_classes (class_number, class_name, is_active)
select distinct cr.class_number, 'Turma ' || cr.class_number, true
from public.class_resources cr
on conflict (class_number) do nothing;

create index if not exists teacher_classes_class_number_idx
  on public.teacher_classes(class_number);

create index if not exists class_students_class_number_idx
  on public.class_students(class_number);

create index if not exists class_students_user_id_idx
  on public.class_students(user_id);

alter table public.teacher_classes enable row level security;
alter table public.class_students enable row level security;
alter table public.class_resources enable row level security;

create table if not exists public.student_frequency (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_date date not null,
  attendance_status text not null check (attendance_status in ('Compareceu', 'Faltou')),
  class_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_frequency_user_id_idx on public.student_frequency(user_id);
create index if not exists student_frequency_class_date_idx on public.student_frequency(class_date desc);

alter table public.student_frequency enable row level security;

create or replace function public.is_teacher_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teacher_admins ta
    where lower(ta.email) = lower(auth.jwt() ->> 'email')
  );
$$;

drop policy if exists "Professores podem gerenciar turmas" on public.teacher_classes;
create policy "Professores podem gerenciar turmas"
  on public.teacher_classes
  for all
  using (public.is_teacher_admin())
  with check (public.is_teacher_admin());

drop policy if exists "Alunos podem visualizar turmas em que estão inscritos" on public.teacher_classes;
create policy "Alunos podem visualizar turmas em que estão inscritos"
  on public.teacher_classes
  for select
  using (
    exists (
      select 1 from public.class_students cs
      where cs.class_number = teacher_classes.class_number
        and cs.user_id = auth.uid()
    )
  );

drop policy if exists "Professores podem visualizar alunos das turmas" on public.class_students;
create policy "Professores podem visualizar alunos das turmas"
  on public.class_students
  for select
  using (public.is_teacher_admin());

drop policy if exists "Alunos podem visualizar sua própria turma" on public.class_students;
create policy "Alunos podem visualizar sua própria turma"
  on public.class_students
  for select
  using (auth.uid() = user_id);

drop policy if exists "Professores podem gerenciar links das turmas" on public.class_resources;
create policy "Professores podem gerenciar links das turmas"
  on public.class_resources
  for all
  using (public.is_teacher_admin())
  with check (public.is_teacher_admin());

drop policy if exists "Alunos podem visualizar links da própria turma" on public.class_resources;
create policy "Alunos podem visualizar links da própria turma"
  on public.class_resources
  for select
  using (
    exists (
      select 1 from public.class_students cs
      where cs.class_number = class_resources.class_number
        and cs.user_id = auth.uid()
    )
  );

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_teacher_classes_updated_at on public.teacher_classes;
create trigger set_teacher_classes_updated_at
before update on public.teacher_classes
for each row
execute function public.set_updated_at();

drop trigger if exists set_class_resources_updated_at on public.class_resources;
create trigger set_class_resources_updated_at
before update on public.class_resources
for each row
execute function public.set_updated_at();

create or replace function public.assert_teacher_class_exists(target_class_number integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.teacher_classes tc
    where tc.class_number = target_class_number
      and tc.is_active = true
  ) then
    raise exception 'Turma não encontrada ou inativa.';
  end if;
end;
$$;

create or replace function public.get_teacher_classes()
returns table (
  id text,
  class_number integer,
  class_name text,
  student_count integer,
  is_active boolean,
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

  return query
  select
    tc.id::text,
    tc.class_number,
    tc.class_name,
    count(cs.user_id)::integer as student_count,
    tc.is_active,
    tc.created_at,
    tc.updated_at
  from public.teacher_classes tc
  left join public.class_students cs on cs.class_number = tc.class_number
  where tc.is_active = true
  group by tc.id, tc.class_number, tc.class_name, tc.is_active, tc.created_at, tc.updated_at
  order by tc.class_number asc;
end;
$$;

grant execute on function public.get_teacher_classes() to authenticated;

create or replace function public.create_teacher_class(target_class_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
  final_name text;
  inserted_id uuid;
begin
  if not public.is_teacher_admin() then
    raise exception 'Acesso negado: usuário não cadastrado como professor.';
  end if;

  select coalesce(max(class_number), 0) + 1
  into next_number
  from public.teacher_classes;

  final_name := coalesce(nullif(trim(target_class_name), ''), 'Turma ' || next_number);

  insert into public.teacher_classes (class_number, class_name, is_active)
  values (next_number, final_name, true)
  returning id into inserted_id;

  return jsonb_build_object('ok', true, 'id', inserted_id, 'class_number', next_number, 'class_name', final_name);
end;
$$;

grant execute on function public.create_teacher_class(text) to authenticated;

create or replace function public.delete_teacher_class(target_class_number integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_students integer := 0;
  deleted_resources integer := 0;
begin
  if not public.is_teacher_admin() then
    raise exception 'Acesso negado: usuário não cadastrado como professor.';
  end if;

  if not exists (select 1 from public.teacher_classes where class_number = target_class_number and is_active = true) then
    raise exception 'Turma não encontrada.';
  end if;

  delete from public.class_students where class_number = target_class_number;
  get diagnostics deleted_students = row_count;

  delete from public.class_resources where class_number = target_class_number;
  get diagnostics deleted_resources = row_count;

  update public.teacher_classes
  set is_active = false,
      class_name = class_name || ' (excluída)'
  where class_number = target_class_number;

  return jsonb_build_object(
    'ok', true,
    'class_number', target_class_number,
    'deleted_students', deleted_students,
    'deleted_resources', deleted_resources
  );
end;
$$;

grant execute on function public.delete_teacher_class(integer) to authenticated;

-- Necessário porque a estrutura de retorno não mudou, mas preservamos a função atualizada com validação dinâmica.
create or replace function public.get_teacher_class_students(target_class_number integer)
returns table (
  id text,
  class_number integer,
  user_id text,
  student_name text,
  student_email text,
  enrollment_code text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_teacher_admin() then
    raise exception 'Acesso negado: usuário não cadastrado como professor.';
  end if;

  perform public.assert_teacher_class_exists(target_class_number);

  return query
  select
    cs.id::text,
    cs.class_number,
    cs.user_id::text,
    coalesce(p.name, u.raw_user_meta_data ->> 'name', u.email, 'Aluno sem nome')::text as student_name,
    coalesce(p.email, u.email, '')::text as student_email,
    coalesce(p.enrollment_code, u.raw_user_meta_data ->> 'enrollment_code', '')::text as enrollment_code,
    cs.created_at
  from public.class_students cs
  left join public.profiles p on p.id = cs.user_id
  left join auth.users u on u.id = cs.user_id
  where cs.class_number = target_class_number
  order by student_name asc, student_email asc;
end;
$$;

grant execute on function public.get_teacher_class_students(integer) to authenticated;

create or replace function public.get_teacher_class_resources(target_class_number integer)
returns table (
  class_number integer,
  video_lesson_url text,
  lesson_material_url text,
  whatsapp_group_url text,
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
    cr.class_number,
    coalesce(cr.video_lesson_url, '')::text,
    coalesce(cr.lesson_material_url, '')::text,
    coalesce(cr.whatsapp_group_url, '')::text,
    cr.updated_at
  from public.class_resources cr
  where cr.class_number = target_class_number;
end;
$$;

grant execute on function public.get_teacher_class_resources(integer) to authenticated;

create or replace function public.save_teacher_class_resources(
  target_class_number integer,
  target_video_lesson_url text,
  target_lesson_material_url text,
  target_whatsapp_group_url text
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

  insert into public.class_resources (
    class_number,
    video_lesson_url,
    lesson_material_url,
    whatsapp_group_url
  )
  values (
    target_class_number,
    nullif(target_video_lesson_url, ''),
    nullif(target_lesson_material_url, ''),
    nullif(target_whatsapp_group_url, '')
  )
  on conflict (class_number) do update
  set
    video_lesson_url = excluded.video_lesson_url,
    lesson_material_url = excluded.lesson_material_url,
    whatsapp_group_url = excluded.whatsapp_group_url;

  return jsonb_build_object('ok', true, 'class_number', target_class_number);
end;
$$;

grant execute on function public.save_teacher_class_resources(integer, text, text, text) to authenticated;

-- Necessário porque a estrutura de retorno desta função mudou para incluir os links da turma.
drop function if exists public.get_my_student_class();

create function public.get_my_student_class()
returns table (
  id text,
  class_number integer,
  class_name text,
  user_id text,
  student_name text,
  student_email text,
  enrollment_code text,
  video_lesson_url text,
  lesson_material_url text,
  whatsapp_group_url text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return query
  select
    cs.id::text,
    cs.class_number,
    coalesce(tc.class_name, 'Turma ' || cs.class_number)::text as class_name,
    cs.user_id::text,
    coalesce(p.name, u.raw_user_meta_data ->> 'name', u.email, 'Aluno sem nome')::text as student_name,
    coalesce(p.email, u.email, '')::text as student_email,
    coalesce(p.enrollment_code, u.raw_user_meta_data ->> 'enrollment_code', '')::text as enrollment_code,
    coalesce(cr.video_lesson_url, '')::text as video_lesson_url,
    coalesce(cr.lesson_material_url, '')::text as lesson_material_url,
    coalesce(cr.whatsapp_group_url, '')::text as whatsapp_group_url,
    cs.created_at
  from public.class_students cs
  left join public.teacher_classes tc on tc.class_number = cs.class_number and tc.is_active = true
  left join public.profiles p on p.id = cs.user_id
  left join auth.users u on u.id = cs.user_id
  left join public.class_resources cr on cr.class_number = cs.class_number
  where cs.user_id = auth.uid()
  order by cs.created_at desc;
end;
$$;

grant execute on function public.get_my_student_class() to authenticated;

create or replace function public.get_teacher_class_activity_history(target_class_number integer)
returns table (
  frequency_id text,
  class_number integer,
  user_id text,
  student_name text,
  student_email text,
  enrollment_code text,
  class_date date,
  attendance_status text,
  class_notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_teacher_admin() then
    raise exception 'Acesso negado: usuário não cadastrado como professor.';
  end if;

  perform public.assert_teacher_class_exists(target_class_number);

  return query
  select
    sf.id::text as frequency_id,
    cs.class_number,
    sf.user_id::text,
    coalesce(p.name, u.raw_user_meta_data ->> 'name', u.email, 'Aluno sem nome')::text as student_name,
    coalesce(p.email, u.email, '')::text as student_email,
    coalesce(p.enrollment_code, u.raw_user_meta_data ->> 'enrollment_code', '')::text as enrollment_code,
    sf.class_date,
    sf.attendance_status,
    coalesce(sf.class_notes, '')::text as class_notes,
    sf.created_at,
    sf.updated_at
  from public.student_frequency sf
  join public.class_students cs
    on cs.user_id = sf.user_id
   and cs.class_number = target_class_number
  left join public.profiles p on p.id = sf.user_id
  left join auth.users u on u.id = sf.user_id
  where sf.class_notes ilike ('[Turma ' || target_class_number || ']%')
  order by sf.class_date desc, sf.created_at desc, student_name asc;
end;
$$;

grant execute on function public.get_teacher_class_activity_history(integer) to authenticated;

create or replace function public.add_teacher_class_student(
  target_class_number integer,
  target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  inserted_id uuid;
begin
  if not public.is_teacher_admin() then
    raise exception 'Acesso negado: usuário não cadastrado como professor.';
  end if;

  perform public.assert_teacher_class_exists(target_class_number);

  if not exists (
    select 1
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.id = target_user_id
      and not exists (
        select 1 from public.teacher_admins ta
        where lower(ta.email) = lower(u.email)
      )
      and (
        coalesce(p.enrolled, false) = true
        or coalesce(p.enrollment_code, '') <> ''
        or coalesce((u.raw_user_meta_data ->> 'enrolled')::boolean, false) = true
        or coalesce(u.raw_user_meta_data ->> 'enrollment_code', '') <> ''
      )
  ) then
    raise exception 'Aluno matriculado não encontrado.';
  end if;

  insert into public.class_students (class_number, user_id)
  values (target_class_number, target_user_id)
  on conflict (class_number, user_id) do update
  set class_number = excluded.class_number
  returning id into inserted_id;

  return jsonb_build_object('ok', true, 'id', inserted_id);
end;
$$;

grant execute on function public.add_teacher_class_student(integer, uuid) to authenticated;

create or replace function public.remove_teacher_class_student(
  target_class_number integer,
  target_user_id uuid
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

  delete from public.class_students
  where class_number = target_class_number
    and user_id = target_user_id;

  if not found then
    raise exception 'Aluno não encontrado nesta turma.';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.remove_teacher_class_student(integer, uuid) to authenticated;

create or replace function public.save_teacher_class_attendance(
  target_class_number integer,
  target_class_date date,
  target_general_notes text,
  attendance_records jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  item jsonb;
  target_user_id uuid;
  target_status text;
  target_notes text;
  inserted_count integer := 0;
begin
  if not public.is_teacher_admin() then
    raise exception 'Acesso negado: usuário não cadastrado como professor.';
  end if;

  perform public.assert_teacher_class_exists(target_class_number);

  if attendance_records is null or jsonb_array_length(attendance_records) = 0 then
    raise exception 'Nenhum aluno foi selecionado para registrar frequência.';
  end if;

  for item in select * from jsonb_array_elements(attendance_records)
  loop
    target_user_id := (item ->> 'user_id')::uuid;
    target_status := coalesce(item ->> 'attendance_status', 'Compareceu');
    target_notes := coalesce(nullif(item ->> 'class_notes', ''), target_general_notes, '');

    if target_status not in ('Compareceu', 'Faltou') then
      raise exception 'Situação inválida para um dos alunos.';
    end if;

    if not exists (
      select 1 from public.class_students cs
      where cs.class_number = target_class_number
        and cs.user_id = target_user_id
    ) then
      raise exception 'Um dos alunos selecionados não pertence a esta turma.';
    end if;

    insert into public.student_frequency (user_id, class_date, attendance_status, class_notes)
    values (
      target_user_id,
      target_class_date,
      target_status,
      '[Turma ' || target_class_number || '] ' || target_notes
    );

    inserted_count := inserted_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'inserted_count', inserted_count);
end;
$$;

grant execute on function public.save_teacher_class_attendance(integer, date, text, jsonb) to authenticated;
