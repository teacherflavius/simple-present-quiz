const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EnrollmentPayload = {
  name?: string;
  email?: string;
  cpf?: string;
  whatsapp?: string;
  pix_key?: string;
  enrollment_code?: string;
  availability?: Record<string, string[]>;
};

function formatAvailability(availability: Record<string, string[]> | undefined): string {
  if (!availability) return "Não informado";

  const dayLabels: Record<string, string> = {
    seg: "Segunda",
    ter: "Terça",
    qua: "Quarta",
    qui: "Quinta",
    sex: "Sexta",
  };

  const hourLabels: Record<string, string> = {
    "09": "9h - 10h",
    "10": "10h - 11h",
    "12": "12h - 13h",
    "13": "13h - 14h",
    "15": "15h - 16h",
    "17": "17h - 18h",
    "18": "18h - 19h",
    "20": "20h - 21h",
    "21": "21h - 22h",
  };

  const lines = Object.entries(dayLabels).map(([day, label]) => {
    const hours = Array.isArray(availability[day]) ? availability[day] : [];
    const formattedHours = hours.map((hour) => hourLabels[hour] || hour).join(", ");
    return `${label}: ${formattedHours || "Nenhum horário selecionado"}`;
  });

  return lines.join("\n");
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const notificationTo = Deno.env.get("ENROLLMENT_NOTIFICATION_TO");
    const notificationFrom = Deno.env.get("ENROLLMENT_NOTIFICATION_FROM") || "Teacher Flávio <onboarding@resend.dev>";

    if (!resendApiKey || !notificationTo) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY or ENROLLMENT_NOTIFICATION_TO" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as EnrollmentPayload;

    const availabilityText = formatAvailability(payload.availability);

    const text = `Nova matrícula recebida\n\nNome: ${payload.name || ""}\nEmail: ${payload.email || ""}\nCPF: ${payload.cpf || ""}\nWhatsApp: ${payload.whatsapp || ""}\nChave PIX: ${payload.pix_key || ""}\nCódigo de matrícula: ${payload.enrollment_code || ""}\n\nDisponibilidade:\n${availabilityText}`;

    const html = `
      <h2>Nova matrícula recebida</h2>
      <p><strong>Nome:</strong> ${escapeHtml(payload.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
      <p><strong>CPF:</strong> ${escapeHtml(payload.cpf)}</p>
      <p><strong>WhatsApp:</strong> ${escapeHtml(payload.whatsapp)}</p>
      <p><strong>Chave PIX:</strong> ${escapeHtml(payload.pix_key)}</p>
      <p><strong>Código de matrícula:</strong> ${escapeHtml(payload.enrollment_code)}</p>
      <h3>Disponibilidade</h3>
      <pre style="font-family: Arial, sans-serif; white-space: pre-wrap; line-height: 1.5;">${escapeHtml(availabilityText)}</pre>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: notificationFrom,
        to: [notificationTo],
        subject: `Nova matrícula: ${payload.name || "Aluno"}`,
        text,
        html,
      }),
    });

    const responseBody = await resendResponse.text();

    if (!resendResponse.ok) {
      return new Response(JSON.stringify({ error: "Email provider error", details: responseBody }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
