let currentProfessorSession = null;
let currentClassNumber = null;
let allStudents = [];
let classStudentIds = new Set();

function getClassNumber() {
  const params = new URLSearchParams(window.location.search);
  const value = Number(params.get("id"));
  if (!Number.isInteger(value) || value < 1 || value > 45) return null;
  return value;
}

function redirectToLogin() {
  window.location.href = "login.html?next=" + encodeURIComponent("turma.html?id=" + currentClassNumber);
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

async function loadStudents() {
  const client = Auth.getClient();
  const response = await client.rpc("get_teacher_students");
  if (response.error) throw response.error;
  return (response.data || []).filter(isEnrolled);
}

async function loadClassStudents() {
  const client = Auth.getClient();
  const response = await client.rpc("get_teacher_class_students", { target_class_number: currentClassNumber });
  if (response.error) throw response.error;
  return response.data || [];
}

async function addStudentToClass(userId, button) {
  button.disabled = true;
  button.textContent = "ADICIONANDO...";

  try {
    const client = Auth.getClient();
    const response = await client.rpc("add_teacher_class_student", {
      target_class_number: currentClassNumber,
      target_user_id: userId
    });
    if (response.error) throw response.error;
    await refreshLists();
  } catch (error) {
    alert("Não foi possível adicionar o aluno: " + (error.message || "erro desconhecido") + ". Execute supabase_turmas.sql no Supabase.");
    button.disabled = false;
    button.textContent = "ADICIONAR À TURMA";
  }
}

async function removeStudentFromClass(userId, button) {
  const confirmed = window.confirm("Remover este aluno da turma " + currentClassNumber + "?");
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "REMOVENDO...";

  try {
    const client = Auth.getClient();
    const response = await client.rpc("remove_teacher_class_student", {
      target_class_number: currentClassNumber,
      target_user_id: userId
    });
    if (response.error) throw response.error;
    await refreshLists();
  } catch (error) {
    alert("Não foi possível remover o aluno: " + (error.message || "erro desconhecido") + ". Execute supabase_turmas.sql no Supabase.");
    button.disabled = false;
    button.textContent = "REMOVER DA TURMA";
  }
}

function renderStudentCard(student, action) {
  const userId = escapeHtml(student.user_id || student.id);
  const name = escapeHtml(student.name || student.email || "Aluno sem nome");
  const email = escapeHtml(student.email || "Não informado");
  const enrollmentCode = escapeHtml(student.enrollment_code || "Não informado");

  const button = action === "remove"
    ? '<button class="delete-button remove-class-student" data-user-id="' + userId + '">REMOVER DA TURMA</button>'
    : '<button class="delete-button add-class-student" data-user-id="' + userId + '" style="border-color:rgba(129,140,248,0.45); background:rgba(129,140,248,0.10); color:#c4b5fd;">ADICIONAR À TURMA</button>';

  return '<div class="student-card">' +
    '<strong>' + name + '</strong>' +
    '<p><b>E-mail:</b> ' + email + '</p>' +
    '<p><b>Número de matrícula:</b> ' + enrollmentCode + '</p>' +
    button +
  '</div>';
}

function attachClassButtons() {
  document.querySelectorAll(".add-class-student").forEach(function (button) {
    button.addEventListener("click", function () {
      addStudentToClass(button.dataset.userId, button);
    });
  });

  document.querySelectorAll(".remove-class-student").forEach(function (button) {
    button.addEventListener("click", function () {
      removeStudentFromClass(button.dataset.userId, button);
    });
  });
}

function renderLists() {
  const classList = document.getElementById("classStudentsList");
  const availableList = document.getElementById("availableStudentsList");

  const classStudents = allStudents.filter(function (student) {
    return classStudentIds.has(student.user_id || student.id);
  });

  const availableStudents = allStudents.filter(function (student) {
    return !classStudentIds.has(student.user_id || student.id);
  });

  if (!classStudents.length) {
    classList.className = "empty";
    classList.textContent = "Nenhum aluno adicionado a esta turma ainda.";
  } else {
    classList.className = "";
    classList.innerHTML = classStudents.map(function (student) {
      return renderStudentCard(student, "remove");
    }).join("");
  }

  if (!availableStudents.length) {
    availableList.className = "empty";
    availableList.textContent = "Todos os alunos matriculados já estão nesta turma.";
  } else {
    availableList.className = "";
    availableList.innerHTML = availableStudents.map(function (student) {
      return renderStudentCard(student, "add");
    }).join("");
  }

  attachClassButtons();
}

async function refreshLists() {
  const classRows = await loadClassStudents();
  classStudentIds = new Set(classRows.map(function (row) { return row.user_id; }));
  renderLists();
}

async function guardPage() {
  const status = document.getElementById("adminStatus");
  currentClassNumber = getClassNumber();

  if (!currentClassNumber) {
    document.getElementById("classTitle").textContent = "Turma inválida";
    status.textContent = "Informe uma turma entre 1 e 45.";
    document.body.classList.remove("auth-checking");
    return;
  }

  document.getElementById("classTitle").textContent = "Turma " + currentClassNumber;

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

  try {
    status.textContent = "Professor autenticado: " + currentProfessorSession.user.email + ".";
    allStudents = await loadStudents();
    await refreshLists();
    document.body.classList.remove("auth-checking");
  } catch (error) {
    status.textContent = "Não foi possível carregar a turma: " + (error.message || "erro desconhecido") + ". Execute supabase_turmas.sql no Supabase.";
    document.body.classList.remove("auth-checking");
  }
}

guardPage();
