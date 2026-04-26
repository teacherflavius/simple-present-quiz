-- Execute este script no Supabase SQL Editor.
-- Ele adiciona à tabela public.profiles os campos usados pela matrícula.

alter table public.profiles
  add column if not exists cpf text,
  add column if not exists whatsapp text,
  add column if not exists enrollment_code text,
  add column if not exists enrolled boolean not null default false;

-- Opcional: impede códigos de matrícula duplicados quando o campo estiver preenchido.
create unique index if not exists profiles_enrollment_code_unique
  on public.profiles (enrollment_code)
  where enrollment_code is not null;

-- Opcional: busca mais rápida por CPF e WhatsApp.
create index if not exists profiles_cpf_idx
  on public.profiles (cpf);

create index if not exists profiles_whatsapp_idx
  on public.profiles (whatsapp);
