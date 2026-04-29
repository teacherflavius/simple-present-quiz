let currentSession = null;

function redirectToLogin() {
  window.location.href = "login.html?next=" + encodeURIComponent("minha_turma.html");
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function waitForAuthResources() {
  for (let i = 0; i < 10; i++) {
    if (window.Auth && window.SUPABASE_CONFIG && Auth.isConfigured()) return true;
    await sleep(150);
  }
  return !!(window.Auth && window.SUPABASE_CONFIG && Auth.isConfigured());
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  });
}

async function loadMyClass() {
  const client = Auth.getClient();
  const response = await client.rpc("get_my_student_class");
  if (response.error) throw response.error;
  return response.data || [];
}

function renderClassCard(row) {
  return '<div class="class-card">' +
    '<h2>' + escapeHtml(row.class_name || "Turma sem nome") + '</h2>' +
    '<p><b>Código da turma:</b> ' + escapeHtml(row.class_code || "Não informado") + '</p>' +
    '<p><b>Professor:</b> ' + escapeHtml(row.teacher_name || "Teacher Flávio") + '</p>' +
    '<p><b>Dias e horários:</b> ' + escapeHtml(row.schedule_text || "Não informado") + '</p>' +
    '<p><b>Modalidade:</b> ' + escapeHtml(row.modality || "Não informado") + '</p>' +
    '<p><b>Data de início:</b> ' + escapeHtml(formatDate(row.start_date)) + '</p>' +
    '<p><b>Status:</b> ' + escapeHtml(row.status || "Ativa") + '</p>' +
    (row.notes ? '<p><b>Observações:</b> ' + escapeHtml(row.notes) + '</p>' : '') +
  '</div>';
}

async function renderMyClass() {
  const content = document.getElementById("studentClassContent");
  try {
    const rows = await loadMyClass();

    if (!rows.length) {
      content.className = "empty-panel";
      content.textContent = "Você ainda não foi inscrito em uma turma pelo professor.";
      return;
    }

    content.className = "";
    content.innerHTML = rows.map(renderClassCard).join("");
  } catch (error) {
    content.className = "empty-panel";
    content.textContent = "Não foi possível carregar sua turma. Execute o arquivo supabase_turmas.sql no Supabase.";
  }
}

async function guardPage() {
  const status = document.getElementById("loginStatus");
  const resourcesReady = await waitForAuthResources();

  if (!resourcesReady) {
    status.textContent = "Não foi possível carregar a autenticação. Atualize a página ou limpe o cache do navegador.";
    document.body.classList.remove("auth-checking");
    return;
  }

  currentSession = await Auth.getSession();
  if (!currentSession || !currentSession.user) {
    redirectToLogin();
    return;
  }

  status.textContent = "Aluno conectado: " + currentSession.user.email + ".";
  document.body.classList.remove("auth-checking");
  await renderMyClass();
}

guardPage();
