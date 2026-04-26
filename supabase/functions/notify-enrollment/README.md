# Notificação de matrícula por e-mail

Esta Edge Function envia um e-mail para o professor sempre que um aluno conclui a matrícula.

## Provedor usado

A função usa Resend.

Crie uma conta em https://resend.com e gere uma API key.

## Variáveis secretas no Supabase

No Supabase Dashboard, vá em:

Project Settings > Edge Functions > Secrets

Adicione:

```text
RESEND_API_KEY=sua_chave_da_resend
ENROLLMENT_NOTIFICATION_TO=seu_email_para_receber_notificacoes
ENROLLMENT_NOTIFICATION_FROM=Teacher Flávio <onboarding@resend.dev>
```

Observação: `onboarding@resend.dev` funciona para testes. Para produção, configure um domínio próprio no Resend e troque o remetente.

## Deploy pela Supabase CLI

```bash
supabase functions deploy notify-enrollment
```

Depois do deploy, o front-end chama automaticamente:

```text
/functions/v1/notify-enrollment
```

A chamada é feita depois de a matrícula ser registrada.
