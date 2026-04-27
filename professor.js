let currentSession = null;

function redirectToLogin() {
  window.location.href = "login.html?next=" + encodeURIComponent("professor.html");
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

function isEnrolled(student) {
  return student.enrolled === true || student.enrolled === "true" || !!student.enrollment_code;
}

function formatAvailability(profile) {
  const days = [["seg", "Segunda"], ["ter", "Terça"], ["qua", "Quarta"], ["qui", "Quinta"], ["sex", "Sexta"]];
  const availability = profile.availability || {};
  const parts = days.map(function (day) {
    const values = Array.isArray(availability[day[0]]) ? availability[day[0]] : [];
    return values.length ? day[1] + ": " + values.join(", ") : "";
  }).filter(Boolean);
  return parts.length ? parts.join(" | ") : "Não informado";
}

async function loadStudents() {
  const client = Auth.getClient();
  const response = await client.rpc("get_teacher_students");
  if (response.error) throw response.error;
  return response.data || [];
}

async function deleteStudent(userId, studentName, button) {
  const confirmed = window.confirm("Tem certeza que deseja excluir a matrícula e os dados de " + (studentName || "este aluno") + "? Essa ação não pode ser desfeita.");
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "EXCLUINDO...";

  try {
    const client = Auth.getClient();
    const response = await client.rpc("delete_teacher_student", { target_user_id: userId });
    if (response.error) throw response.error;
    await renderStudents();
  } catch (error) {
    alert("Não foi possível excluir o aluno: " + (error.message || "erro desconhecido") + ". Reexecute o SQL atualizado no Supabase.");
    button.disabled = false;
    button.textContent = "EXCLUIR MATRÍCULA E DADOS DO ALUNO";
  }
}

async function renderStudents() {
  const list = document.getElementById("studentsList");
  try {
    const students = await loadStudents();

    if (!students.length) {
      list.className = "empty";
      list.textContent = "Nenhum aluno encontrado. Verifique se há registros na tabela profiles.";
      return;
    }

    list.className = "";
    list.innerHTML = students.map(function (student) {
      const enrolled = isEnrolled(student);
      return '<div class="student-card">' +
        '<strong>' + escapeHtml(student.name || "Aluno sem nome") +
        '<span class="pill ' + (enrolled ? '' : 'pending') + '">' + (enrolled ? 'Matriculado' : 'Cadastro sem matrícula confirmada') + '</span></strong>' +
        '<p><b>E-mail:</b> ' + escapeHtml(student.email || "Não informado") + '</p>' +
        '<p><b>WhatsApp:</b> ' + escapeHtml(student.whatsapp || "Não informado") + '</p>' +
        '<p><b>CPF:</b> ' + escapeHtml(student.cpf || "Não informado") + '</p>' +
        '<p><b>Código de matrícula:</b> ' + escapeHtml(student.enrollment_code || "Não informado") + '</p>' +
        '<p><b>Disponibilidade:</b> ' + escapeHtml(formatAvailability(student)) + '</p>' +
        '<button class="delete-button" data-user-id="' + escapeHtml(student.user_id || student.id) + '" data-student-name="' + escapeHtml(student.name || student.email || "Aluno") + '">EXCLUIR MATRÍCULA E DADOS DO ALUNO</button>' +
      '</div>';
    }).join("");

    document.querySelectorAll(".delete-button").forEach(function (button) {
      button.addEventListener("click", function () {
        deleteStudent(button.dataset.userId, button.dataset.studentName, button);
      });
    });
  } catch (error) {
    list.className = "error";
    list.textContent = "Não foi possível carregar os alunos: " + (error.message || "erro desconhecido") + ". Reexecute o arquivo supabase_professor_admin.sql no Supabase, trocando professor@email.com pelo seu e-mail.";
  }
}

async function guardProfessorArea() {
  const status = document.getElementById("adminStatus");
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

  status.textContent = "Professor autenticado: " + currentSession.user.email + ".";
  document.body.classList.remove("auth-checking");
  await renderStudents();
}

guardProfessorArea();
