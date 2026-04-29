let currentProfessorSession = null;

function redirectToLogin() {
  window.location.href = "login.html?next=" + encodeURIComponent("criar_exercicio.html");
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

function makeExerciseId(title) {
  return "teacher-" + String(title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") + "-" + Date.now();
}

async function loadTeacherExercises() {
  const client = Auth.getClient();
  const response = await client.rpc("get_teacher_created_exercises");
  if (response.error) throw response.error;
  return response.data || [];
}

function renderExerciseCard(exercise) {
  return '<div class="exercise-card">' +
    '<strong>' + escapeHtml(exercise.exercise_title || "Exercício sem título") + '</strong>' +
    '<p><b>Link:</b> <a href="' + escapeHtml(exercise.exercise_url || "#") + '" target="_blank" rel="noopener noreferrer" style="color:#c4b5fd;">' + escapeHtml(exercise.exercise_url || "") + '</a></p>' +
    '<p><b>Status:</b> ' + (exercise.is_active ? 'Ativo' : 'Inativo') + '</p>' +
  '</div>';
}

async function renderTeacherExercises() {
  const list = document.getElementById("teacherExercisesList");
  try {
    const exercises = await loadTeacherExercises();
    if (!exercises.length) {
      list.className = "empty";
      list.textContent = "Nenhum exercício criado pelo professor ainda.";
      return;
    }
    list.className = "";
    list.innerHTML = exercises.map(renderExerciseCard).join("");
  } catch (error) {
    list.className = "error";
    list.textContent = "Não foi possível carregar os exercícios. Execute supabase_exercicios_professor.sql no Supabase.";
  }
}

async function createExercise(event) {
  event.preventDefault();
  const message = document.getElementById("createExerciseMessage");
  const titleInput = document.getElementById("exerciseTitle");
  const urlInput = document.getElementById("exerciseUrl");
  const title = titleInput.value.trim();
  const url = urlInput.value.trim();

  message.className = "empty";
  message.textContent = "Salvando exercício...";

  try {
    if (!title || !url) throw new Error("Informe o título e o link do exercício.");

    const client = Auth.getClient();
    const response = await client.rpc("create_teacher_exercise", {
      target_exercise_id: makeExerciseId(title),
      target_exercise_title: title,
      target_exercise_url: url
    });

    if (response.error) throw response.error;

    document.getElementById("createExerciseForm").reset();
    message.className = "empty";
    message.textContent = "Exercício salvo e publicado na página Exercícios Diários.";
    await renderTeacherExercises();
  } catch (error) {
    message.className = "error";
    message.textContent = "Não foi possível salvar o exercício: " + (error.message || "erro desconhecido") + ". Execute supabase_exercicios_professor.sql no Supabase.";
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

  status.textContent = "Professor autenticado: " + currentProfessorSession.user.email + ".";
  document.body.classList.remove("auth-checking");
  await renderTeacherExercises();
}

const createExerciseForm = document.getElementById("createExerciseForm");
if (createExerciseForm) createExerciseForm.addEventListener("submit", createExercise);

guardPage();
