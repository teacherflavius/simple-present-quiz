-- Área administrativa do professor
-- Execute este arquivo no Supabase em SQL Editor > Run.
-- Substitua professor@email.com pelo e-mail usado pelo professor para login.

create table if not exists public.teacher_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text unique not null,
  created_at timestamptz not null default now()
);

alter table public.teacher_admins enable row level security;

drop policy if exists "Professor pode verificar suas próprias credenciais" on public.teacher_admins;
create policy "Professor pode verificar suas próprias credenciais"
  on public.teacher_admins
  for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- IMPORTANTE: troque professor@email.com pelo seu e-mail real de login antes de executar.
insert into public.teacher_admins (email)
values ('professor@email.com')
on conflict (email) do nothing;

alter table public.profiles enable row level security;

drop policy if exists "Professores podem visualizar alunos matriculados" on public.profiles;
drop policy if exists "Professores podem visualizar perfis" on public.profiles;
create policy "Professores podem visualizar perfis"
  on public.profiles
  for select
  using (
    exists (
      select 1 from public.teacher_admins ta
      where lower(ta.email) = lower(auth.jwt() ->> 'email')
    )
  );

-- Função usada pela página professor.html.
-- Ela busca alunos em public.profiles e também em auth.users/raw_user_meta_data.
-- Isso resolve o caso em que o cadastro foi criado no Auth, mas o registro ainda não apareceu em profiles.
create or replace function public.get_teacher_students()
returns table (
  id text,
  user_id text,
  name text,
  email text,
  cpf text,
  whatsapp text,
  enrollment_code text,
  enrolled boolean,
  availability jsonb,
  source text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requester_email text;
begin
  requester_email := auth.jwt() ->> 'email';

  if requester_email is null or not exists (
    select 1 from public.teacher_admins ta
    where lower(ta.email) = lower(requester_email)
  ) then
    raise exception 'Acesso negado: usuário não cadastrado como professor.';
  end if;

  return query
  with profile_rows as (
    select
      p.id::uuid as uid,
      p.id::text as id,
      p.id::text as user_id,
      coalesce(p.name, '')::text as name,
      coalesce(p.email, '')::text as email,
      coalesce(p.cpf, '')::text as cpf,
      coalesce(p.whatsapp, '')::text as whatsapp,
      coalesce(p.enrollment_code, '')::text as enrollment_code,
      coalesce(p.enrolled, false)::boolean as enrolled,
      coalesce(p.availability::jsonb, '{}'::jsonb) as availability,
      'profiles'::text as source,
      null::timestamptz as created_at
    from public.profiles p
  ),
  auth_rows as (
    select
      u.id::uuid as uid,
      u.id::text as id,
      u.id::text as user_id,
      coalesce(u.raw_user_meta_data ->> 'name', '')::text as name,
      coalesce(u.email, '')::text as email,
      coalesce(u.raw_user_meta_data ->> 'cpf', '')::text as cpf,
      coalesce(u.raw_user_meta_data ->> 'whatsapp', '')::text as whatsapp,
      coalesce(u.raw_user_meta_data ->> 'enrollment_code', '')::text as enrollment_code,
      coalesce((u.raw_user_meta_data ->> 'enrolled')::boolean, false)::boolean as enrolled,
      coalesce(u.raw_user_meta_data -> 'availability', '{}'::jsonb) as availability,
      'auth.users'::text as source,
      u.created_at as created_at
    from auth.users u
    where not exists (
      select 1 from public.teacher_admins ta
      where lower(ta.email) = lower(u.email)
    )
  ),
  merged_rows as (
    select * from profile_rows
    union all
    select * from auth_rows ar
    where not exists (
      select 1 from profile_rows pr
      where pr.uid = ar.uid
    )
  )
  select
    mr.id,
    mr.user_id,
    mr.name,
    mr.email,
    mr.cpf,
    mr.whatsapp,
    mr.enrollment_code,
    mr.enrolled,
    mr.availability,
    mr.source,
    mr.created_at
  from merged_rows mr
  where not exists (
    select 1 from public.teacher_admins ta
    where lower(ta.email) = lower(mr.email)
  )
  order by mr.name asc nulls last, mr.email asc nulls last;
end;
$$;

grant execute on function public.get_teacher_students() to authenticated;
