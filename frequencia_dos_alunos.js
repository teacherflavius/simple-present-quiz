let currentProfessorSession = null;

function redirectToLogin() {
  window.location.href = "login.html?next=" + encodeURIComponent("frequencia_dos_alunos.html");
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

async function loadStudents() {
  const client = Auth.getClient();
  const response = await client.rpc("get_teacher_students");
  if (response.error) throw response.error;
  return response.data || [];
}

async function renderStudents() {
  const list = document.getElementById("studentsList");
  try {
    const students = await loadStudents();

    if (!students.length) {
      list.className = "empty";
      list.textContent = "Nenhum aluno encontrado.";
      return;
    }

    list.className = "menu-grid";
    list.innerHTML = students.map(function (student) {
      const userId = encodeURIComponent(student.user_id || student.id);
      const name = encodeURIComponent(student.name || student.email || "Aluno");
      const email = encodeURIComponent(student.email || "");
      const href = "frequencia_aluno.html?user_id=" + userId + "&name=" + name + "&email=" + email;
      return '<a class="menu-button" href="' + href + '">' +
        '<span><span class="icon">👤</span>' + escapeHtml(student.name || student.email || "Aluno sem nome") + '</span>' +
        '<span class="arrow">›</span>' +
      '</a>';
    }).join("");
  } catch (error) {
    list.className = "error";
    list.textContent = "Não foi possível carregar os alunos: " + (error.message || "erro desconhecido") + ". Reexecute os SQLs administrativos no Supabase.";
  }
}

async function guardPage() {
  const status = document.getElementById("adminStatus");
  const resourcesReady = await waitForAuthResources();

  if (!resourcesReady) {
    status.textContent = "Não foi possível carregar a autenticação. Atualize a página ou limpe o cache do navegador.";
    document.body.classList.remove("auth-checking");
    return;
  }

  currentProfessorSession = await Auth.getSession();
  if (!currentProfessorSession || !currentProfessorSession.user) {
    redirectToLogin();
    return;
  }

  status.textContent = "Professor autenticado: " + currentProfessorSession.user.email + ". Selecione um aluno.";
  document.body.classList.remove("auth-checking");
  await renderStudents();
}

guardPage();
