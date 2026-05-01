# Implementação LGPD: dados privados de alunos

Este documento descreve a segunda etapa de endurecimento de privacidade do projeto.

## Objetivo

Separar dados pessoais operacionais de alunos — CPF, WhatsApp e chave PIX — dos metadados públicos do Supabase Auth e do perfil geral do aluno.

Antes desta etapa, esses dados eram gravados em `auth.users.raw_user_meta_data` e também em `profiles`. Isso aumentava a superfície de exposição, porque `user_metadata` é facilmente consumido pelo front-end autenticado.

A nova estrutura move esses dados para `public.student_private_data`, com RLS própria e acesso controlado.

## Nova tabela

Arquivo SQL principal:

```text
supabase_lgpd_private_student_data.sql
```

Tabela criada:

```text
public.student_private_data
```

Campos:

```text
user_id
cpf
whatsapp
pix_key
consent_lgpd
consent_lgpd_at
created_at
updated_at
```

## Regras de acesso

A tabela usa Row Level Security.

Políticas criadas:

1. O aluno pode visualizar seus próprios dados privados.
2. O aluno pode inserir seus próprios dados privados.
3. O aluno pode atualizar seus próprios dados privados.
4. O professor/admin pode visualizar dados privados de alunos, desde que `public.is_teacher_admin()` retorne `true`.

## Funções RPC

### `public.upsert_my_private_student_data(...)`

Permite que o próprio aluno grave ou atualize CPF, WhatsApp, chave PIX e consentimento LGPD.

### `public.get_my_private_student_data()`

Permite que o próprio aluno consulte seus dados privados.

## Migração dos dados existentes

O arquivo `supabase_lgpd_private_student_data.sql` também copia dados antigos de `profiles` para `student_private_data`.

Depois de validar a migração, ele executa limpeza opcional do metadata legado:

```sql
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
  - 'cpf'
  - 'whatsapp'
  - 'pix_key'
where raw_user_meta_data ?| array['cpf', 'whatsapp', 'pix_key'];
```

## Atualização das funções administrativas

Arquivo SQL complementar:

```text
supabase_lgpd_professor_private_data_update.sql
```

Ele atualiza:

```text
public.get_teacher_students()
public.update_teacher_student_profile(...)
```

Essas funções passam a ler e escrever CPF, WhatsApp e chave PIX em `student_private_data`.

## Alteração no front-end

Arquivo alterado:

```text
auth.js
```

Mudanças principais:

1. `enrollStudent()` deixa de enviar CPF, WhatsApp e chave PIX para `auth.signUp(... options.data ...)`.
2. `updateProfile()` deixa de enviar CPF, WhatsApp e chave PIX para `auth.updateUser(... data ...)`.
3. Novas funções foram adicionadas:
   - `Auth.savePrivateStudentData()`
   - `Auth.getPrivateStudentData()`
4. `getProfile()` junta os dados gerais de `profiles` com os dados privados vindos de `student_private_data`.

## Sequência recomendada de aplicação

1. Executar `supabase_lgpd_private_student_data.sql` no Supabase.
2. Conferir se `student_private_data` foi populada corretamente.
3. Executar `supabase_lgpd_professor_private_data_update.sql`.
4. Publicar o front-end atualizado.
5. Testar matrícula, edição de perfil e área do professor.

## Testes manuais recomendados

### Aluno novo

1. Fazer matrícula.
2. Confirmar que `auth.users.raw_user_meta_data` não contém CPF, WhatsApp ou chave PIX.
3. Confirmar que `student_private_data` contém CPF, WhatsApp e chave PIX.

### Aluno existente

1. Executar a migração.
2. Confirmar que dados antigos foram copiados de `profiles` para `student_private_data`.
3. Confirmar que o metadata legado foi limpo em `auth.users`.

### Área do professor

1. Entrar como professor/admin.
2. Abrir lista de alunos.
3. Confirmar que CPF, WhatsApp e PIX continuam aparecendo para o professor.
4. Editar um aluno.
5. Confirmar que a edição atualiza `student_private_data`.

## Próxima melhoria recomendada

Adicionar checkbox explícito no formulário de matrícula:

```text
Li e concordo com o tratamento dos meus dados pessoais para fins de matrícula, contato, organização de aulas e eventuais reembolsos.
```

Esse checkbox deve enviar `consent_lgpd: true` para `Auth.enrollStudent()`.
