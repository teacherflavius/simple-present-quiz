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

function formatDateTime(value) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function loadMyClass() {
  const client = Auth.getClient();
  const response = await client.rpc("get_my_student_class");
  if (response.error) throw response.error;
  const rows = response.data || [];
  return mergeRecordedLessonsUrls(rows);
}

async function mergeRecordedLessonsUrls(rows) {
  if (!rows.length) return rows;

  const hasRecordedLessonsUrl = rows.some(function (row) {
    return typeof row.recorded_lessons_url !== "undefined";
  });

  const classNumbers = rows
    .map(function (row) { return row.class_number; })
    .filter(function (value, index, list) { return value && list.indexOf(value) === index; });

  if (!classNumbers.length) return rows;

  try {
    const client = Auth.getClient();
    const response = await client
      .from("class_resources")
      .select("class_number, recorded_lessons_url")
      .in("class_number", classNumbers);

    if (response.error) throw response.error;

    const urlsByClass = {};
    (response.data || []).forEach(function (item) {
      urlsByClass[item.class_number] = item.recorded_lessons_url || "";
    });

    return rows.map(function (row) {
      if (!row.recorded_lessons_url && urlsByClass[row.class_number]) {
        return Object.assign({}, row, { recorded_lessons_url: urlsByClass[row.class_number] });
      }
      return row;
    });
  } catch (error) {
    if (!hasRecordedLessonsUrl) {
      console.warn("Campo recorded_lessons_url não disponível em class_resources:", error.message || error);
    }
    return rows;
  }
}

function renderResourceLink(url, label) {
  if (!url) return '';
  return '<a class="menu-button" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer" style="margin-top:10px;">' +
    '<span><span class="icon">🔗</span>' + escapeHtml(label) + '</span><span class="arrow">›</span>' +
  '</a>';
}

function getDisplayClassName(row) {
  return row.class_name || "Turma";
}

function renderClassCard(row) {
  const links = [
    renderResourceLink(row.video_lesson_url, "ASSISTIR A AULA"),
    renderResourceLink(row.lesson_material_url, "ANOTAÇÕES DA AULA"),
    renderResourceLink(row.recorded_lessons_url, "AULAS GRAVADAS"),
    renderResourceLink(row.whatsapp_group_url, "WHATSAPP")
  ].join("");

  return '<div class="class-card">' +
    '<h2>' + escapeHtml(getDisplayClassName(row)) + '</h2>' +
    '<p><b>Aluno:</b> ' + escapeHtml(row.student_name || "Não informado") + '</p>' +
    '<p><b>E-mail:</b> ' + escapeHtml(row.student_email || "Não informado") + '</p>' +
    '<p><b>Número de matrícula:</b> ' + escapeHtml(row.enrollment_code || "Não informado") + '</p>' +
    '<p><b>Inscrito na turma em:</b> ' + escapeHtml(formatDateTime(row.created_at)) + '</p>' +
    '<div style="margin-top:14px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.08);">' +
      '<p><b>Links da turma:</b></p>' +
      (links || '<p>Nenhum link foi cadastrado pelo professor ainda.</p>') +
    '</div>' +
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
    content.textContent = "Não foi possível carregar sua turma. Reexecute os arquivos supabase_turmas.sql e supabase_aulas_gravadas.sql no Supabase.";
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
