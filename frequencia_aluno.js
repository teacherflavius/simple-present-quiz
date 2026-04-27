let currentSession = null;
let selectedStudent = null;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    userId: params.get("user_id") || "",
    name: params.get("name") || "Aluno",
    email: params.get("email") || ""
  };
}

function redirectToLogin() {
  window.location.href = "login.html?next=" + encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search);
}

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

async function loadFrequency() {
  const client = Auth.getClient();
  const response = await client.rpc("get_teacher_student_frequency", { target_user_id: selectedStudent.userId });
  if (response.error) throw response.error;
  return response.data || [];
}

function renderHistoryItem(record) {
  return '<div class="student-card">' +
    '<strong>' + escapeHtml(record.class_date) + ' — ' + escapeHtml(record.attendance_status) + '</strong>' +
    '<p><b>Lições / observações:</b> ' + escapeHtml(record.class_notes || 'Sem observações.') + '</p>' +
  '</div>';
}

async function renderFrequencyHistory() {
  const list = document.getElementById("frequencyList");
  try {
    const records = await loadFrequency();
    if (!records.length) {
      list.className = "empty";
      list.textContent = "Nenhum registro de frequência cadastrado para este aluno.";
      return;
    }
    list.className = "";
    list.innerHTML = records.map(renderHistoryItem).join("");
  } catch (error) {
    list.className = "error";
    list.textContent = "Não foi possível carregar a frequência: " + (error.message || "erro desconhecido") + ". Execute supabase_frequencia_professor.sql no Supabase.";
  }
}

async function saveFrequency(event) {
  event.preventDefault();
  const message = document.getElementById("formMessage");
  message.className = "empty";
  message.textContent = "Salvando...";

  try {
    const classDate = document.getElementById("classDate").value;
    const attendanceStatus = document.getElementById("attendanceStatus").value;
    const classNotes = document.getElementById("classNotes").value.trim();

    if (!classDate) throw new Error("Informe a data da aula.");

    const client = Auth.getClient();
    const response = await client.rpc("save_teacher_student_frequency", {
      target_user_id: selectedStudent.userId,
      target_class_date: classDate,
      target_attendance_status: attendanceStatus,
      target_class_notes: classNotes
    });

    if (response.error) throw response.error;

    document.getElementById("frequencyForm").reset();
    message.className = "empty";
    message.textContent = "Registro salvo.";
    await renderFrequencyHistory();
  } catch (error) {
    message.className = "error";
    message.textContent = error.message || "Não foi possível salvar o registro.";
  }
}

async function guardPage() {
  const status = document.getElementById("adminStatus");
  selectedStudent = getParams();

  document.getElementById("studentName").textContent = selectedStudent.name;
  document.getElementById("studentEmail").textContent = selectedStudent.email || "E-mail não informado";

  if (!selectedStudent.userId) {
    status.textContent = "Aluno não informado.";
    document.body.classList.remove("auth-checking");
    return;
  }

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
  await renderFrequencyHistory();
}

document.getElementById("frequencyForm").addEventListener("submit", saveFrequency);
guardPage();
