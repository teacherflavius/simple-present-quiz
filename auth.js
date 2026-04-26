(function () {
  function isConfigured() {
    return window.SUPABASE_CONFIG &&
      window.SUPABASE_CONFIG.url &&
      window.SUPABASE_CONFIG.anonKey &&
      !window.SUPABASE_CONFIG.url.includes("COLE_AQUI") &&
      !window.SUPABASE_CONFIG.anonKey.includes("COLE_AQUI");
  }

  function getClient() {
    if (!isConfigured()) return null;
    if (!window.supabase || !window.supabase.createClient) return null;
    if (!window.teacherFlavioSupabase) {
      window.teacherFlavioSupabase = window.supabase.createClient(
        window.SUPABASE_CONFIG.url,
        window.SUPABASE_CONFIG.anonKey
      );
    }
    return window.teacherFlavioSupabase;
  }

  function getRedirectUrl() {
    return new URL("login.html", window.location.href).href;
  }

  function showConfigWarning() {
    if (document.getElementById("supabase-config-warning")) return;
    const warning = document.createElement("div");
    warning.id = "supabase-config-warning";
    warning.style.position = "fixed";
    warning.style.left = "12px";
    warning.style.right = "12px";
    warning.style.bottom = "12px";
    warning.style.zIndex = "20000";
    warning.style.background = "rgba(251,191,36,0.12)";
    warning.style.border = "1px solid rgba(251,191,36,0.35)";
    warning.style.color = "#fde68a";
    warning.style.borderRadius = "12px";
    warning.style.padding = "12px 14px";
    warning.style.fontFamily = "Georgia, serif";
    warning.style.fontSize = "13px";
    warning.style.lineHeight = "1.5";
    warning.textContent = "Supabase ainda não configurado. Edite supabase_config.js com a URL e a chave pública anon do seu projeto.";
    document.body.appendChild(warning);
  }

  function generateEnrollmentCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  function normalizeCpf(cpf) {
    return String(cpf || "").replace(/\D/g, "");
  }

  function normalizeWhatsapp(whatsapp) {
    return String(whatsapp || "").replace(/\D/g, "");
  }

  async function getSession() {
    const client = getClient();
    if (!client) return null;
    const response = await client.auth.getSession();
    return response && response.data ? response.data.session : null;
  }

  async function getUser() {
    const client = getClient();
    if (!client) return null;
    const response = await client.auth.getUser();
    return response && response.data ? response.data.user : null;
  }

  async function requireAuth() {
    if (!isConfigured()) {
      showConfigWarning();
      return null;
    }
    const session = await getSession();
    if (!session) {
      const next = encodeURIComponent(window.location.pathname.split("/").pop() || "index.html");
      window.location.href = "login.html?next=" + next;
      return null;
    }
    return session.user;
  }

  async function signUp(name, email, password) {
    const client = getClient();
    if (!client) throw new Error("Supabase não configurado.");
    const response = await client.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { name: name },
        emailRedirectTo: getRedirectUrl()
      }
    });
    if (response.error) throw response.error;

    if (response.data && response.data.user) {
      await client.from("profiles").upsert({
        id: response.data.user.id,
        name: name,
        email: email
      });
    }
    return response.data;
  }

  async function enrollStudent(data) {
    const client = getClient();
    if (!client) throw new Error("Supabase não configurado.");

    const enrollmentCode = generateEnrollmentCode();
    const cleanCpf = normalizeCpf(data.cpf);
    const cleanWhatsapp = normalizeWhatsapp(data.whatsapp);

    if (!data.name || !data.email || !data.password || !cleanCpf || !cleanWhatsapp) {
      throw new Error("Preencha todos os campos da matrícula.");
    }

    if (cleanCpf.length !== 11) {
      throw new Error("CPF inválido. Informe 11 dígitos.");
    }

    if (cleanWhatsapp.length < 10) {
      throw new Error("WhatsApp inválido.");
    }

    const response = await client.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
          cpf: cleanCpf,
          whatsapp: cleanWhatsapp,
          enrollment_code: enrollmentCode,
          enrolled: true
        },
        emailRedirectTo: getRedirectUrl()
      }
    });

    if (response.error) throw response.error;

    if (response.data && response.data.user) {
      const profilePayload = {
        id: response.data.user.id,
        name: data.name,
        email: data.email,
        cpf: cleanCpf,
        whatsapp: cleanWhatsapp,
        enrollment_code: enrollmentCode,
        enrolled: true
      };

      const profileResponse = await client.from("profiles").upsert(profilePayload).select().single();
      if (profileResponse.error) {
        throw new Error("Conta criada, mas não foi possível registrar a matrícula em profiles. Verifique se a tabela profiles possui as colunas cpf, whatsapp, enrollment_code e enrolled.");
      }
    }

    return {
      user: response.data ? response.data.user : null,
      enrollment_code: enrollmentCode
    };
  }

  async function signIn(email, password) {
    const client = getClient();
    if (!client) throw new Error("Supabase não configurado.");
    const response = await client.auth.signInWithPassword({ email: email, password: password });
    if (response.error) throw response.error;
    return response.data;
  }

  async function signOut() {
    const client = getClient();
    if (!client) return;
    await client.auth.signOut();
    window.location.href = "login.html";
  }

  async function getProfile() {
    const client = getClient();
    const user = await getUser();
    if (!client || !user) return null;
    const response = await client.from("profiles").select("*").eq("id", user.id).single();
    if (response.error) return { id: user.id, name: user.user_metadata && user.user_metadata.name || "", email: user.email };
    return response.data;
  }

  async function saveActivityResult(result) {
    const client = getClient();
    const user = await getUser();
    if (!client || !user) return null;

    const payload = {
      user_id: user.id,
      activity_type: result.activity_type || result.type || "activity",
      activity_title: result.activity_title || result.quiz || result.title,
      score: Number(result.score),
      total: Number(result.total),
      percentage: Math.round((Number(result.score) / Number(result.total)) * 100),
      completed_at: new Date().toISOString()
    };

    const response = await client.from("activity_results").insert(payload).select().single();
    if (response.error) {
      console.warn("Erro ao salvar no Supabase:", response.error.message);
      return null;
    }
    return response.data;
  }

  async function getMyResults() {
    const client = getClient();
    const user = await getUser();
    if (!client || !user) return [];
    const response = await client
      .from("activity_results")
      .select("*")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false });
    if (response.error) return [];
    return response.data || [];
  }

  window.Auth = {
    isConfigured,
    getClient,
    showConfigWarning,
    generateEnrollmentCode,
    getSession,
    getUser,
    requireAuth,
    signUp,
    enrollStudent,
    signIn,
    signOut,
    getProfile,
    saveActivityResult,
    getMyResults
  };
})();
