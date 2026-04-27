let currentProfessorSession = null;

function redirectProfessorToLogin() {
  window.location.href = "login.html?next=" + encodeURIComponent("professor.html");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForProfessorAuthResources() {
  for (let i = 0; i < 10; i++) {
    if (window.Auth && window.SUPABASE_CONFIG && Auth.isConfigured()) return true;
    await sleep(150);
  }
  return !!(window.Auth && window.SUPABASE_CONFIG && Auth.isConfigured());
}

async function guardProfessorHome() {
  const status = document.getElementById("adminStatus");
  const resourcesReady = await waitForProfessorAuthResources();

  if (!resourcesReady) {
    if (status) status.textContent = "Não foi possível carregar a autenticação. Atualize a página ou limpe o cache do navegador.";
    document.body.classList.remove("auth-checking");
    return;
  }

  currentProfessorSession = await Auth.getSession();
  if (!currentProfessorSession || !currentProfessorSession.user) {
    redirectProfessorToLogin();
    return;
  }

  if (status) status.textContent = "Professor autenticado: " + currentProfessorSession.user.email + ".";
  document.body.classList.remove("auth-checking");
}

guardProfessorHome();
